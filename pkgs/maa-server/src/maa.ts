import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as url from 'node:url'
import { v4 } from 'uuid'

import type { ControllerRuntime, InterfaceRuntime } from '@nekosu/maa-pipeline-manager'

import {
  type AgentInfo,
  destroyAgent,
  destroyResourceAfterAgentCleanup,
  notifyAgentStopped,
  startAgent
} from './agent'
import { ipc } from './apis'
import { option } from './options'
import { logger } from './server'
import { releaseQuickRecoSession } from './tools/reco'
import { convertImage } from './tools/utils'

export async function initMaa() {
  const importTarget = path.join(option.module, '@maaxyz/maa-node/dist/index-client.js')
  await import(url.pathToFileURL(importTarget).toString())

  logger.info(maa.Global.version)
  maa.Global.debug_mode = option.debugMode
  maa.Global.log_dir = option.maaLog
  maa.Global.save_draw = option.saveDraw
  maa.Global.save_on_error = option.saveOnError
}

type InstanceCache = {
  controller: maa.Controller
}

type TaskerInstance = {
  tasker: maa.Tasker
  resource: maa.Resource
  controller: maa.Controller
  agents: AgentInfo[]
}

let cache: InstanceCache | undefined
let cacheKey: string | undefined
let taskerInst: TaskerInstance | undefined

const taskerMap: Record<string, TaskerInstance> = {}

// 从 gamescope 实例列表中按 display_no 匹配目标实例，用于解析 pw_node_id / eis_socket_path。
// 匹配不到（或匹配到的实例没有 PipeWire 节点，即 pipewire_node_id === 0）时，
// 回退到第一个带 PipeWire 节点的实例（与 MaaPiCli 一致）。
function pickGamescopeInstance(
  instances: maa.GamescopeInstance[],
  displayNo?: number
): maa.GamescopeInstance | undefined {
  if (displayNo !== undefined) {
    const byDisplay = instances.find(inst => inst[0] === displayNo && inst[1] !== 0)
    if (byDisplay) {
      return byDisplay
    }
  }
  return instances.find(inst => inst[1] !== 0)
}

// Linux 控制器的设备发现 API 自 MaaFramework 5.13.0-beta.3 起提供；服务端支持运行时切换框架
// 版本，旧版本下返回空列表而不是抛 TypeError
export async function findGamescopeInstances() {
  if (!maa.LinuxController?.find_gamescope_instances) {
    return []
  }
  return (await maa.LinuxController.find_gamescope_instances()) ?? []
}

// MaaToolkit 在 Linux 上返回 [id, 完整 socket 路径, socket 文件名]，客户端取第二项作为
// wlr_socket_path（原生侧会对其执行存在性检查，相对文件名不可用）
export async function findWlrCompositor() {
  if (!maa.LinuxController?.find_wlr_compositor) {
    return []
  }
  return (await maa.LinuxController.find_wlr_compositor()) ?? []
}

export async function updateCtrl(runtime: ControllerRuntime) {
  const key = JSON.stringify(runtime)
  if (key !== cacheKey) {
    cache = undefined
    cacheKey = undefined
  }

  let controller: maa.Controller | undefined = cache?.controller

  if (controller) {
    return true
  }

  if (runtime.type === 'adb') {
    controller = new maa.AdbController(...runtime.args)
  } else if (runtime.type === 'win32') {
    controller = new maa.Win32Controller(...runtime.args)
  } else if (runtime.type === 'playcover') {
    controller = new maa.PlayCoverController(...runtime.args)
  } else if (runtime.type === 'gamepad') {
    controller = new maa.GamepadController(...runtime.args)
  } else if (runtime.type === 'linux') {
    // 协议标注 Linux 控制器仅 Linux 可用；非 Linux 平台上 binding 的
    // new maa.LinuxController() 会直接抛 TypeError（find_gamescope_instances 则干净返回 null）
    if (process.platform !== 'linux') {
      logger.info('Linux controller is only supported on Linux')
      return false
    }

    // Linux 控制器所需的 API（LinuxController / LinuxScreencapMethod / find_gamescope_instances）
    // 自 MaaFramework 5.13.0-beta.3 起提供；当前选中的框架可能是更早的版本
    // （服务端支持运行时切换），此时显式报错而不是抛 TypeError
    if (!maa.LinuxController?.find_gamescope_instances) {
      logger.info('Linux controller is not supported by the active MaaFramework')
      return false
    }

    // 客户端侧配置 JSON（含 pipewire_source/display_no 标记字段，C++ 会忽略未知字段）
    let conf: Record<string, unknown>
    try {
      conf = JSON.parse(runtime.args[0])
    } catch {
      return false
    }

    const screencap = conf.screencap_method as number
    const input = conf.input_method as number
    const pipewireSource = conf.pipewire_source as string | undefined
    // display_no 只用于服务端匹配 gamescope 实例，必须在从 conf 中剥离前取出
    const displayNo = conf.display_no as number | undefined
    delete conf.pipewire_source
    delete conf.display_no

    if (pipewireSource === 'Portal') {
      logger.info('Linux controller: pipewire_source Portal is not supported yet')
      return false
    }

    // Gamescope 直连或 Libei 输入需要现查 gamescope 实例，注入 pw_node_id / eis_socket_path。
    // binding 导出的常量是字符串（uint64 转字符串，如 "4"），配置 JSON 中是数字，统一转 Number 比较。
    if (
      screencap === Number(maa.LinuxScreencapMethod.PipeWire) ||
      input === Number(maa.LinuxInputMethod.Libei)
    ) {
      const instances = await maa.LinuxController.find_gamescope_instances()
      const target = pickGamescopeInstance(instances ?? [], displayNo)
      if (!target) {
        logger.info('Linux controller: no gamescope instance found')
        return false
      }
      conf.pw_node_id = target[1]
      if (input === Number(maa.LinuxInputMethod.Libei)) {
        conf.eis_socket_path = target[2]
      }
    }

    controller = new maa.LinuxController(JSON.stringify(conf))
  } else if (runtime.type === 'vscFixed') {
    if (!existsSync(runtime.args[0])) {
      return false
    }
    const image = (await fs.readFile(runtime.args[0])).buffer as ArrayBuffer
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

  // display_short_side / display_long_side / display_expand / display_raw 互斥，
  // 按协议只取第一个提供的字段。display_expand 为 Unity Canvas Scaler Expand 语义的
  // 参考分辨率 [width, height]，需 MaaFramework 绑定提供 screenshot_target_expand。
  if (runtime.display_short_side) {
    controller.screenshot_target_short_side = runtime.display_short_side
  } else if (runtime.display_long_side) {
    controller.screenshot_target_long_side = runtime.display_long_side
  } else if (runtime.display_expand) {
    controller.screenshot_target_expand = runtime.display_expand
  } else if (runtime.display_raw) {
    controller.screenshot_use_raw_size = true
  }

  controller.add_sink((_, msg) => {
    logger.info(`${JSON.stringify(msg)}`)
  })

  await controller.post_connection().wait()

  if (controller.connected) {
    cache = {
      controller
    }
    cacheKey = key
    return true
  } else {
    controller.destroy()
    return false
  }
}

async function setupResource(
  runtime: InterfaceRuntime,
  timeout: number
): Promise<{ resource: maa.Resource; agents: AgentInfo[] } | null> {
  const resource = new maa.Resource()

  resource.add_sink((_, msg) => {
    logger.info(`${JSON.stringify(msg)}`)
  })

  for (const p of runtime.resource.paths) {
    await resource.post_bundle(path.resolve(runtime.root, p)).wait()
  }
  for (const p of runtime.controller.attach_resource_path ?? []) {
    await resource.post_bundle(path.resolve(runtime.root, p)).wait()
  }

  const agents: AgentInfo[] = []
  for (const agentConfig of runtime.agent) {
    const info = await startAgent(
      agentConfig,
      {
        root: runtime.root,
        resources: runtime.resource.paths,
        timeout
      },
      resource
    )
    if (!info) {
      for (const agent of agents) {
        destroyAgent(agent)
      }
      // 失败分支的 client 可能仍在 connect 清理中，Resource 不能抢先销毁
      destroyResourceAfterAgentCleanup(resource)
      return null
    }
    agents.push(info)
  }

  return {
    resource,
    agents
  }
}

export async function setupInst(
  runtime: InterfaceRuntime,
  timeout: number
): Promise<{
  handle?: string
  error?: string
}> {
  // 启动正式实例前释放快速识别缓存的 agent 会话：同名 identifier / 同一 AgentServer
  // 重复启动会互相抢占，且面板复用时缓存已无意义
  releaseQuickRecoSession()

  for (const agent of taskerInst?.agents ?? []) {
    destroyAgent(agent)
  }
  taskerInst?.tasker.destroy()
  taskerInst?.resource.destroy()
  taskerInst = undefined

  if (!(await updateCtrl(runtime.controller))) {
    return {
      error: 'maa.debug.init-controller-failed'
    }
  }

  const controller = cache?.controller

  if (!cache || !controller) {
    return {
      error: 'maa.debug.init-controller-failed'
    }
  }

  const resourceInfo = await setupResource(runtime, timeout)
  if (!resourceInfo) {
    return {
      error: 'maa.debug.init-resource-failed'
    }
  }

  const tasker = new maa.Tasker()

  tasker.add_sink((_, msg) => {
    logger.info(`${JSON.stringify(msg)}`)
  })

  tasker.add_context_sink((_, msg) => {
    logger.info(`${JSON.stringify(msg)}`)
  })

  tasker.controller = controller
  tasker.resource = resourceInfo.resource

  for (const { client } of resourceInfo.agents) {
    client.register_controller_sink(controller)
    client.register_resource_sink(resourceInfo.resource)
    client.register_tasker_sink(tasker)
  }

  if (!tasker.inited) {
    for (const agent of resourceInfo.agents) {
      destroyAgent(agent)
    }
    tasker.destroy()
    destroyResourceAfterAgentCleanup(resourceInfo.resource)
    return {
      error: 'maa.debug.init-instance-failed'
    }
  }

  taskerInst = {
    tasker,
    controller,
    resource: resourceInfo.resource,
    agents: resourceInfo.agents
  }

  const handle = v4()
  taskerMap[handle] = taskerInst

  taskerInst.tasker.add_sink(async (_, msg) => {
    try {
      await ipc.pushNotify(handle, msg)
    } catch (err) {
      logger.warn(`pushNotify ${handle} failed: ${err}`)
    }
  })
  taskerInst.tasker.add_context_sink(async (_, msg) => {
    try {
      await ipc.pushNotify(handle, msg)
    } catch (err) {
      logger.warn(`pushNotify ${handle} failed: ${err}`)
    }
  })

  cache = undefined
  cacheKey = undefined
  taskerInst = undefined

  return {
    handle
  }
}

export async function getScreencap(id?: string) {
  const controller = id ? taskerMap[id]?.controller : cache?.controller
  if (!controller) {
    return null
  }
  const image = await controller.post_screencap().wait().get()
  if (image) {
    return Buffer.from(image).toString('base64')
  } else {
    return null
  }
}

export async function resize(image: string, width: number, height: number) {
  const buffer = convertImage(image)
  const newBuffer = maa.Global.resize_image(buffer, width, height)
  return Buffer.from(newBuffer).toString('base64')
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

  for (const agent of inst.agents) {
    destroyAgent(agent)
  }
  inst.tasker.destroy()
  inst.resource.destroy()
  inst.controller.destroy()
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

export async function agentStopped(id: string) {
  notifyAgentStopped(id)
}
