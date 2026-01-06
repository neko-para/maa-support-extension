import { existsSync } from 'fs'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as vscode from 'vscode'

import { InterfaceRuntime } from '@mse/types'
import { logger, loggerChannel, t } from '@mse/utils'

import { debugService, interfaceService, nativeService } from '.'
import { currentWorkspace } from '../utils/fs'
import { BaseService } from './context'
import { WebviewLaunchPanel } from './webview/launch'

type InstanceCache = {
  controller: maa.Controller
}

export type TaskerInstance = {
  tasker: maa.Tasker
  resource: maa.Resource
  controller: maa.Controller
  client?: maa.Client
  agent?: vscode.TaskExecution | vscode.DebugSession
}

export function stopAgent(agent?: vscode.TaskExecution | vscode.DebugSession) {
  if (!agent) {
    return
  }
  if ('task' in agent) {
    agent.terminate()
  } else {
    vscode.debug.stopDebugging(agent)
  }
}

export class LaunchService extends BaseService {
  cache?: InstanceCache
  cacheKey?: string
  tasker?: TaskerInstance

  constructor() {
    super()
    console.log('construct LaunchService')
  }

  async init() {
    console.log('init LaunchService')
  }

  buildControllerRuntime(): InterfaceRuntime['controller_param'] | null {
    const data = interfaceService.interfaceJson
    const config = interfaceService.interfaceConfigJson
    if (!data || !config) {
      return null
    }

    const ctrlInfo = data.controller?.find(x => x.name === config.controller?.name)

    if (!ctrlInfo) {
      vscode.window.showErrorMessage(
        t('maa.pi.error.cannot-find-controller', config.controller?.name ?? '<unknown>')
      )
      return null
    }

    const fixNum = (v?: string | number, dic?: Record<string, string>) => {
      if (typeof v === 'number') {
        return `${v}`
      } else if (dic && typeof v === 'string' && v in dic) {
        return dic[v]
      } else {
        return v
      }
    }

    if (ctrlInfo.type === 'Adb') {
      if (!config.adb) {
        vscode.window.showErrorMessage(
          t('maa.pi.error.cannot-find-adb-for-controller', config.controller?.name ?? '<unknown>')
        )
        return null
      }

      return {
        ctype: 'adb',
        adb_path: config.adb.adb_path,
        address: config.adb.address,
        screencap: config.adb.screencap ?? maa.AdbScreencapMethod.Default,
        input: config.adb.input ?? maa.AdbInputMethod.Default,
        config: JSON.stringify(config.adb.config),

        display_short_side: ctrlInfo.display_short_side,
        display_long_side: ctrlInfo.display_long_side,
        display_raw: ctrlInfo.display_raw
      }
    } else if (ctrlInfo.type === 'Win32') {
      if (!config.win32) {
        vscode.window.showErrorMessage(
          t('maa.pi.error.cannot-find-win32-for-controller', config.controller?.name ?? '<unknown>')
        )
        return null
      }

      if (!config.win32.hwnd) {
        vscode.window.showErrorMessage(
          t('maa.pi.error.cannot-find-hwnd-for-controller', config.controller?.name ?? '<unknown>')
        )
        return null
      }

      return {
        ctype: 'win32',
        hwnd: config.win32.hwnd,
        screencap:
          fixNum(ctrlInfo.win32?.screencap, maa.Win32ScreencapMethod) ??
          maa.Win32ScreencapMethod.DXGI_DesktopDup,
        mouse:
          fixNum(ctrlInfo.win32?.mouse, maa.Win32InputMethod) ?? maa.Win32InputMethod.SendMessage,
        keyboard:
          fixNum(ctrlInfo.win32?.keyboard, maa.Win32InputMethod) ??
          maa.Win32InputMethod.SendMessage,

        display_short_side: ctrlInfo.display_short_side,
        display_long_side: ctrlInfo.display_long_side,
        display_raw: ctrlInfo.display_raw
      }
    } else if (ctrlInfo.type === 'VscFixed') {
      if (!config.vscFixed) {
        vscode.window.showErrorMessage('No vscFixed for controller')
        return null
      }

      if (!config.vscFixed.image) {
        vscode.window.showErrorMessage('No vscFixed image for controller')
        return null
      }

      return {
        ctype: 'vscFixed',
        image: config.vscFixed.image,

        display_short_side: ctrlInfo.display_short_side,
        display_long_side: ctrlInfo.display_long_side,
        display_raw: ctrlInfo.display_raw
      }
    }

    return null
  }

  async updateCache() {
    const runtime = this.buildControllerRuntime()

    if (!runtime) {
      return false
    }

    const key = JSON.stringify(runtime)
    if (key !== this.cacheKey) {
      this.cache = undefined
      this.cacheKey = undefined
    }

    let controller: maa.Controller | undefined = this.cache?.controller

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
      logger.info(`${JSON.stringify(msg)}`)
    })

    await controller.post_connection().wait()

    if (controller.connected) {
      this.cache = { controller }
      this.cacheKey = key
      return true
    } else {
      controller.destroy()
      return false
    }
  }

  async setupResource(
    runtime: InterfaceRuntime
  ): Promise<
    [
      maa.Resource | null,
      maa.Client | undefined,
      vscode.TaskExecution | vscode.DebugSession | undefined
    ]
  > {
    const resource = new maa.Resource()

    resource.add_sink((_, msg) => {
      logger.info(`${JSON.stringify(msg)}`)
    })

    for (const path of runtime.resource_path) {
      await resource.post_bundle(path).wait()
    }

    let client: maa.Client | undefined = undefined
    let agent: vscode.TaskExecution | vscode.DebugSession | undefined = undefined
    if (runtime.agent) {
      client = new maa.Client(runtime.agent.identifier)
      const identifier = client.identifier ?? 'vsc-no-identifier'

      logger.info(`AgentClient listening ${identifier}`)

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
                logger.info(`Replace {AGENT_ID} in ${key}`)
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
        const succ = await vscode.debug.startDebugging(
          vscode.workspace.workspaceFolders![0],
          config
        )
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
        (vscode.workspace.getConfiguration('maa').get('agentTimeout') as number | undefined) ??
        30000
      if (timeout >= 0) {
        client.timeout = timeout.toString()
      }
      client.bind_resource(resource)
      logger.info(`AgentClient start connecting ${identifier}`)
      if (
        !(await client
          .connect()
          .then(
            () => true,
            () => false
          )
          .then(res => {
            logger.info(`AgentClient start connect ${res ? 'succeed' : 'failed'}`)
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

    return [resource, client, agent]
  }

  async setupInstance(runtime: InterfaceRuntime): Promise<[false, string] | [true, null]> {
    this.tasker?.tasker.destroy()
    this.tasker?.resource.destroy()
    this.tasker = undefined

    if (!(await this.updateCache())) {
      return [false, t('maa.debug.init-controller-failed')]
    }

    const controller = this.cache?.controller

    if (!controller) {
      return [false, t('maa.debug.init-controller-failed')]
    }

    const [resource, client, agent] = await this.setupResource(runtime)
    if (!resource) {
      return [false, t('maa.debug.init-resource-failed')]
    }

    const tasker = new maa.Tasker()

    tasker.add_sink((_, msg) => {
      logger.info(`${JSON.stringify(msg)}`)
    })

    tasker.add_context_sink((_, msg) => {
      logger.info(`${JSON.stringify(msg)}`)
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
      stopAgent(agent)
      return [false, t('maa.debug.init-instance-failed')]
    }

    this.tasker = {
      tasker: tasker,
      controller,
      resource,
      client,
      agent
    }

    return [true, null]
  }

  async launchRuntime(runtime: InterfaceRuntime, tasks?: InterfaceRuntime['task']) {
    loggerChannel.show(true)
    try {
      await this.launchRuntimeImpl(runtime, tasks)
    } catch (err) {
      logger.error(`${err}`)
    }
  }

  async launchRuntimeImpl(runtime: InterfaceRuntime, tasks?: InterfaceRuntime['task']) {
    const session = await debugService.startSession()

    const [setupSuccess, setupError] = await this.setupInstance(runtime)

    if (!setupSuccess) {
      session.pushMessage(setupError)
      session.pushTerminated()
      return
    }

    if (!this.tasker) {
      session.pushMessage(t('maa.debug.init-instance-failed'))
      session.pushTerminated()
      return
    }

    session.pushMessage(t('maa.debug.init-instance-succeeded'))
    session.pushContinued()

    const tasker = this.tasker
    this.tasker = undefined
    const panel = new WebviewLaunchPanel(tasker, 'maa launch')
    await panel.init()

    session.handlePause = async () => {
      panel.pause()
    }

    session.handleContinue = async () => {
      panel.cont()
    }

    session.handleTerminate = async () => {
      await panel.stop()
    }

    const mergeParams = (data: unknown[]) => {
      // 目前空数组override会失败，临时修复下
      if (data.length === 0) {
        return {}
      }
      return data as Record<string, unknown>[]
    }
    // const mergeParam = (data?: unknown) => {
    //   for (const [task, opt] of Object.entries((data as Record<string, unknown>) ?? {})) {
    //     param[task] = Object.assign(param[task] ?? {}, opt)
    //   }
    // }

    for (const task of tasks ?? runtime.task) {
      session.pushMessage(t('maa.debug.task-started', task.name, task.entry))
      const succeeded = await tasker.tasker
        .post_task(task.entry, mergeParams(task.pipeline_override))
        .wait().succeeded
      session.pushMessage(
        succeeded
          ? t('maa.debug.task-finished', task.name, task.entry)
          : t('maa.debug.task-failed', task.name, task.entry)
      )
    }
    panel.finish()

    session.pushExited()
  }
}
