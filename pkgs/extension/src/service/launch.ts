import path from 'path'
import * as vscode from 'vscode'

import { InterfaceRuntime } from '@mse/types'
import { logger, loggerChannel, t } from '@mse/utils'

import { debugService, interfaceService } from '.'
import { Maa, maa } from '../maa'
import { BaseService } from './context'
import { WebviewLaunchPanel } from './webview/launch'

type InstanceCache = {
  controller: Maa.ControllerBase
}

export type TaskerInstance = {
  tasker: Maa.TaskerBase
  resource: Maa.ResourceBase
  controller: Maa.ControllerBase
  agent?: vscode.TaskExecution
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

  async buildControllerRuntime(): Promise<InterfaceRuntime['controller_param'] | null> {
    const data = interfaceService.interfaceJson
    const config = interfaceService.interfaceConfigJson
    if (!data || !config) {
      return null
    }

    const ctrlInfo = data.controller?.find(x => x.name === config.controller?.name)

    if (!ctrlInfo) {
      await vscode.window.showErrorMessage(
        t('maa.pi.error.cannot-find-controller', config.controller?.name ?? '<unknown>')
      )
      return null
    }

    if (ctrlInfo.type === 'Adb') {
      if (!config.adb) {
        await vscode.window.showErrorMessage(
          t('maa.pi.error.cannot-find-adb-for-controller', config.controller?.name ?? '<unknown>')
        )
        return null
      }

      return {
        ctype: 'adb',
        adb_path: config.adb.adb_path,
        address: config.adb.address,
        config: JSON.stringify(ctrlInfo.adb?.config ?? config.adb.config),
        screencap: ctrlInfo.adb?.screencap ?? maa.api.AdbScreencapMethod.Default,
        input: ctrlInfo.adb?.input ?? maa.api.AdbInputMethod.Default
      }
    } else if (ctrlInfo.type === 'Win32') {
      if (!config.win32) {
        await vscode.window.showErrorMessage(
          t('maa.pi.error.cannot-find-win32-for-controller', config.controller?.name ?? '<unknown>')
        )
        return null
      }

      if (!config.win32.hwnd) {
        await vscode.window.showErrorMessage(
          t('maa.pi.error.cannot-find-hwnd-for-controller', config.controller?.name ?? '<unknown>')
        )
        return null
      }

      return {
        ctype: 'win32',
        hwnd: config.win32.hwnd,
        screencap: ctrlInfo.win32?.screencap ?? maa.api.Win32ScreencapMethod.DXGI_DesktopDup,
        input: ctrlInfo.win32?.input ?? maa.api.Win32InputMethod.Seize
      }
    }

    return null
  }

  async updateCache() {
    const runtime = await this.buildControllerRuntime()

    if (!runtime) {
      return false
    }

    const key = JSON.stringify(runtime)
    if (key !== this.cacheKey) {
      this.cache = undefined
      this.cacheKey = undefined
    }

    let controller: Maa.ControllerBase | undefined = this.cache?.controller

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
      controller = new maa.Win32Controller(runtime.hwnd, runtime.screencap, runtime.input)
    } else {
      return false
    }

    controller.notify = (msg, detail) => {
      logger.info(`${msg} ${detail}`)
    }

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
  ): Promise<[Maa.Resource | null, vscode.TaskExecution | undefined]> {
    const resource = new maa.Resource()

    resource.notify = (msg, detail) => {
      logger.info(`${msg} ${detail}`)
    }

    for (const path of runtime.resource_path) {
      await resource.post_bundle(path).wait()
    }

    let agent: vscode.TaskExecution | undefined = undefined
    if (runtime.agent) {
      const client = new maa.AgentClient()
      const identifier = client.identifier ?? 'vsc-no-identifier'

      logger.info(`AgentClient listening ${identifier}`)

      if (runtime.agent.child_exec) {
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
        return [null, undefined]
      }
    }

    return [resource, agent]
  }

  async setupInstance(runtime: InterfaceRuntime): Promise<[false, string] | [true, null]> {
    this.tasker?.tasker.destroy()
    this.tasker?.resource.destroy()
    this.tasker = undefined

    if (!(await this.updateCache())) {
      return [false, '初始化控制器失败']
    }

    const controller = this.cache?.controller

    if (!controller) {
      return [false, '初始化控制器失败']
    }

    const [resource, agent] = await this.setupResource(runtime)
    if (!resource) {
      return [false, '初始化资源失败']
    }

    const tasker = new maa.Tasker()

    tasker.notify = (msg, detail) => {
      logger.info(`${msg} ${detail}`)
    }

    tasker.bind(controller)
    tasker.bind(resource)

    if (!tasker.inited) {
      tasker.destroy()
      resource.destroy()
      agent?.terminate()
      return [false, '初始化实例失败']
    }

    this.tasker = {
      tasker: tasker,
      controller,
      resource,
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
      session.pushMessage('初始化实例失败')
      session.pushTerminated()
      return
    }

    session.pushMessage('初始化实例成功')
    session.pushContinued()

    const tasker = this.tasker
    this.tasker = undefined
    const panel = new WebviewLaunchPanel(tasker, 'Maa launch')
    await panel.init()

    session.handlePause = async () => {
      panel.pause()
    }

    session.handleContinue = async () => {
      panel.cont()
    }

    for (const task of tasks ?? runtime.task) {
      session.pushMessage(`任务开始 ${task.name} - ${task.entry}`)
      const succeed = await tasker.tasker
        .post_task(task.entry, task.pipeline_override as Record<string, unknown>)
        .wait().succeeded
      session.pushMessage(`任务${succeed ? '完成' : '失败'} ${task.name} - ${task.entry}`)
    }
    panel.finish()

    session.pushExited()
  }
}
