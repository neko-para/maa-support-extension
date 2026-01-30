import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { v4 } from 'uuid'

import type { InterfaceRuntime } from '@mse/types'

import { ipc } from './apis'
import { option } from './options'
import { sendLog } from './server'

export function initMaa() {
  module.paths.unshift(option.module)
  require('@maaxyz/maa-node')

  sendLog(maa.Global.version)
  maa.Global.debug_mode = true
  maa.Global.log_dir = option.maaLog
}

type InstanceCache = {
  controller: maa.Controller
}

type TaskerInstance = {
  tasker: maa.Tasker
  resource: maa.Resource
  controller: maa.Controller
  client?: maa.Client
  agent?: string
}

let cache: InstanceCache | undefined
let cacheKey: string | undefined
let taskerInst: TaskerInstance | undefined

const taskerMap: Record<string, TaskerInstance> = {}

export async function updateCtrl(runtime: InterfaceRuntime['controller_param']) {
  const key = JSON.stringify(runtime)
  if (key !== cacheKey) {
    cache = undefined
    cacheKey = undefined
  }

  let controller: maa.Controller | undefined = cache?.controller

  if (controller) {
    return true
  }

  if (runtime.ctype === 'adb') {
    controller = new maa.AdbController(
      runtime.adb_path,
      runtime.address,
      runtime.screencap,
      runtime.input,
      runtime.config
    )
  } else if (runtime.ctype === 'win32') {
    controller = new maa.Win32Controller(
      runtime.hwnd,
      runtime.screencap,
      runtime.mouse,
      runtime.keyboard
    )
  } else if (runtime.ctype === 'vscFixed') {
    const image = (await fs.readFile(runtime.image)).buffer as ArrayBuffer
    controller = new maa.CustomController({
      connect() {
        return true
      },
      request_uuid() {
        return '0'
      },
      screencap() {
        return image
      }
    })
  } else {
    return false
  }

  if (runtime.display_short_side) {
    controller.screenshot_target_short_side = runtime.display_short_side
  } else if (runtime.display_long_side) {
    controller.screenshot_target_long_side = runtime.display_long_side
  } else if (runtime.display_raw) {
    controller.screenshot_use_raw_size = true
  }

  controller.add_sink((_, msg) => {
    sendLog(`${JSON.stringify(msg)}`)
  })

  await controller.post_connection().wait()

  if (controller.connected) {
    cache = { controller }
    cacheKey = key
    return true
  } else {
    controller.destroy()
    return false
  }
}

async function setupResource(
  runtime: InterfaceRuntime
): Promise<[maa.Resource | null, maa.Client | undefined, string | undefined]> {
  const resource = new maa.Resource()

  resource.add_sink((_, msg) => {
    sendLog(`${JSON.stringify(msg)}`)
  })

  for (const path of runtime.resource_path) {
    await resource.post_bundle(path).wait()
  }

  let client: maa.Client | undefined = undefined
  let agent: string | undefined = undefined

  if (runtime.agent) {
    client = new maa.Client(runtime.agent.identifier)
    const identifier = client.identifier ?? 'vsc-no-identifier'

    sendLog(`AgentClient listening ${identifier}`)

    if (runtime.agent.debug_session) {
      const handle = await ipc.startDebugSession(runtime.agent.debug_session, identifier)
      if (!handle) {
        resource.destroy()
        return [null, undefined, undefined]
      }
      agent = handle
    } else if (runtime.agent.child_exec) {
      const handle = await ipc.startTask(
        runtime.agent.child_exec,
        (runtime.agent.child_args ?? []).concat([identifier]),
        runtime.root,
        {
          VSCODE_MAAFW_AGENT: '1',
          VSCODE_MAAFW_AGENT_ROOT: runtime.root,
          VSCODE_MAAFW_AGENT_RESOURCE: runtime.resource_path.join(path.delimiter)
        }
      )
      if (!handle) {
        resource.destroy()
        return [null, undefined, undefined]
      }
      agent = handle
    }

    client.bind_resource(resource)
    sendLog(`AgentClient start connecting ${identifier}`)
    if (
      !(await client
        .connect()
        .then(
          () => true,
          () => false
        )
        .then(res => {
          sendLog(`AgentClient start connect ${res ? 'succeed' : 'failed'}`)
          return res
        }))
    ) {
      resource.destroy()
      if (agent) {
        ipc.stopAgent(agent)
      }
      return [null, undefined, undefined]
    }
  }

  return [resource, client, agent]
}

export async function setupInst(runtime: InterfaceRuntime): Promise<{
  handle?: string
  error?: string
}> {
  taskerInst?.tasker.destroy()
  taskerInst?.resource.destroy()
  taskerInst = undefined

  if (!(await updateCtrl(runtime['controller_param']))) {
    return {
      error: 'maa.debug.init-controller-failed'
    }
  }

  const controller = cache?.controller

  if (!controller) {
    return {
      error: 'maa.debug.init-controller-failed'
    }
  }

  const [resource, client, agent] = await setupResource(runtime)
  if (!resource) {
    return {
      error: 'maa.debug.init-resource-failed'
    }
  }

  const tasker = new maa.Tasker()

  tasker.add_sink((_, msg) => {
    sendLog(`${JSON.stringify(msg)}`)
  })

  tasker.add_context_sink((_, msg) => {
    sendLog(`${JSON.stringify(msg)}`)
  })

  tasker.controller = controller
  tasker.resource = resource

  client?.register_controller_sink(controller)
  client?.register_resource_sink(resource)
  client?.register_tasker_sink(tasker)

  if (!tasker.inited) {
    tasker.destroy()
    resource.destroy()
    client?.destroy()
    if (agent) {
      ipc.stopAgent(agent)
    }
    return {
      error: 'maa.debug.init-instance-failed'
    }
  }

  taskerInst = {
    tasker,
    controller,
    resource,
    client,
    agent
  }

  const handle = v4()
  taskerMap[handle] = taskerInst

  taskerInst.tasker.add_sink(async (_, msg) => {
    await ipc.pushNotify(handle, msg)
  })
  taskerInst.tasker.add_context_sink(async (_, msg) => {
    await ipc.pushNotify(handle, msg)
  })

  cache = undefined
  cacheKey = undefined
  taskerInst = undefined

  return {
    handle
  }
}

export async function getScreencap() {
  if (!cache) {
    return null
  }
  const image = await cache.controller.post_screencap().wait().get()
  if (image) {
    return Buffer.from(image).toString('base64')
  } else {
    return null
  }
}

export async function postTask(
  id: string,
  task: string,
  pipeline_override: Record<string, unknown>[]
) {
  const inst = taskerMap[id]
  if (!inst) {
    return false
  }

  return await inst.tasker.post_task(task, pipeline_override).wait().succeeded
}

export async function postStop(id: string) {
  const inst = taskerMap[id]
  if (!inst) {
    return
  }

  await inst.tasker.post_stop().wait()
}

export async function getKnownTasks(id: string) {
  const inst = taskerMap[id]
  if (!inst) {
    return []
  }

  return (inst.resource.node_list ?? []).sort()
}

export async function destroyInstance(id: string) {
  const inst = taskerMap[id]
  if (!inst) {
    return
  }

  delete taskerMap[id]

  inst.tasker.destroy()
  inst.resource.destroy()
  inst.controller.destroy()
  if (inst.agent) {
    ipc.stopAgent(inst.agent)
  }
}

function toPngDataUrl(buffer: Uint8Array | ArrayBuffer) {
  if (buffer instanceof ArrayBuffer) {
    return 'data:image/png;base64,' + Buffer.from(buffer).toString('base64')
  } else {
    return 'data:image/png;base64,' + Buffer.from(buffer).toString('base64')
  }
}

export async function getRecoDetail(id: string, recoId: maa.RecoId) {
  const inst = taskerMap[id]
  if (!inst) {
    return null
  }

  const detail = inst.tasker.recognition_detail(recoId)
  if (!detail) {
    return null
  }
  const info = {
    ...detail
  } as Partial<maa.RecoDetail>
  delete info.raw
  delete info.draws

  return {
    info: info as maa.RecoDetailWithoutDraws,
    raw: toPngDataUrl(detail.raw),
    draws: detail.draws.map(toPngDataUrl)
  }
}

export async function getActDetail(id: string, actId: maa.ActId) {
  const inst = taskerMap[id]
  if (!inst) {
    return null
  }

  return inst.tasker.action_detail(actId)
}

export async function getNode(id: string, task: string) {
  const inst = taskerMap[id]
  if (!inst) {
    return null
  }

  return inst.resource.get_node_data(task)
}
