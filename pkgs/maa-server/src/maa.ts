import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { v4 } from 'uuid'

import type { InterfaceRuntime } from '@mse/types'

import { option } from './options'
import { sendLog } from './server'

export function initMaa() {
  module.paths.unshift(option.module)
  require('@maaxyz/maa-node')

  sendLog(maa.Global.version)
}

type InstanceCache = {
  controller: maa.Controller
}

type TaskerInstance = {
  tasker: maa.Tasker
  resource: maa.Resource
  controller: maa.Controller
  client?: maa.Client
  // agent?: vscode.TaskExecution | vscode.DebugSession
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

async function setupResource(runtime: InterfaceRuntime): Promise<
  [
    maa.Resource | null,
    maa.Client | undefined
    // vscode.TaskExecution | vscode.DebugSession | undefined
  ]
> {
  const resource = new maa.Resource()

  resource.add_sink((_, msg) => {
    sendLog(`${JSON.stringify(msg)}`)
  })

  for (const path of runtime.resource_path) {
    await resource.post_bundle(path).wait()
  }

  let client: maa.Client | undefined = undefined
  // let agent: vscode.TaskExecution | vscode.DebugSession | undefined = undefined
  /*
  if (runtime.agent) {
    client = new maa.Client(runtime.agent.identifier)
    const identifier = client.identifier ?? 'vsc-no-identifier'

    sendLog(`AgentClient listening ${identifier}`)

    if (runtime.agent.debug_session) {
      const launchJsonPath = path.join(currentWorkspace()!.fsPath, '.vscode', 'launch.json')
      if (!existsSync(launchJsonPath)) {
        logger.error('Cannot find launch.json')
        resource.destroy()
        return [null, undefined, undefined]
      }
      const launchJson = JSON.parse(await fs.readFile(launchJsonPath, 'utf8')) as {
        configurations: vscode.DebugConfiguration[]
      }
      const config = launchJson.configurations.find(
        cfg => cfg.name === runtime.agent?.debug_session
      )
      if (!config) {
        logger.error(`Cannot find debug session ${runtime.agent.debug_session}`)
        resource.destroy()
        return [null, undefined, undefined]
      }
      let replaced = false
      for (const key of Object.keys(config)) {
        const val = config[key]
        if (Array.isArray(val)) {
          config[key] = val.map(v => {
            if (typeof v === 'string' && v === '{AGENT_ID}') {
              sendLog(`Replace {AGENT_ID} in ${key}`)
              replaced = true
              return identifier
            } else {
              return v
            }
          })
        }
      }
      if (!replaced) {
        logger.warn('No {AGENT_ID} found in config')
      }

      const disp = vscode.debug.onDidStartDebugSession(session => {
        agent = session
      })
      const succ = await vscode.debug.startDebugging(vscode.workspace.workspaceFolders![0], config)
      disp.dispose()
      if (!(succ && agent)) {
        logger.error('Create debug session failed')
        resource.destroy()
        return [null, undefined, undefined]
      }
    } else if (runtime.agent.child_exec) {
      const task = new vscode.Task(
        {
          type: 'shell'
        },
        vscode.TaskScope.Workspace,
        'maa-agent-server',
        'maa',
        new vscode.ShellExecution(
          runtime.agent.child_exec,
          (runtime.agent.child_args ?? []).concat([identifier]),
          {
            cwd: runtime.root,
            env: {
              VSCODE_MAAFW_AGENT: '1',
              VSCODE_MAAFW_AGENT_ROOT: runtime.root,
              VSCODE_MAAFW_AGENT_RESOURCE: runtime.resource_path.join(path.delimiter)
            }
          }
        )
      )
      agent = await vscode.tasks.executeTask(task)
    }

    const timeout =
      (vscode.workspace.getConfiguration('maa').get('agentTimeout') as number | undefined) ?? 30000
    if (timeout >= 0) {
      client.timeout = timeout.toString()
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
      agent?.terminate()
      return [null, undefined, undefined]
    }
    if (timeout >= 0) {
      client.timeout = Number.MAX_SAFE_INTEGER.toString()
    }
  }
*/
  // return [resource, client, agent]
  return [resource, client]
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

  const [resource, client] = await setupResource(runtime)
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
    // stopAgent(agent)
    return {
      error: 'maa.debug.init-instance-failed'
    }
  }

  taskerInst = {
    tasker,
    controller,
    resource,
    client
    // agent
  }

  const handle = v4()
  taskerMap[handle] = taskerInst

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
