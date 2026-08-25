import * as vscode from 'vscode'

import { t } from '@nekosu/maa-locale'
import type {
  ControllerRuntime,
  InterfaceConfig,
  InterfaceRuntime
} from '@nekosu/maa-pipeline-manager'

import { logger, loggerChannel } from '../utils/logger'
import { BaseService } from './context'
import { debugService, interfaceService, rootService, serverService } from './registry'
import { WebviewLaunchPanel } from './webview/launch'

// export function stopAgent(agent?: vscode.TaskExecution | vscode.DebugSession) {
//   if (!agent) {
//     return
//   }
//   if ('task' in agent) {
//     agent.terminate()
//   } else {
//     vscode.debug.stopDebugging(agent)
//   }
// }

export class LaunchService extends BaseService {
  private startupConnection?: Promise<boolean>
  private startupConnectionPending = false

  constructor() {
    super()
    console.log('construct LaunchService')
  }

  async init() {
    console.log('init LaunchService')

    this.defer = rootService.onActiveResourceChanged(() => {
      if (this.startupConnection) {
        this.startupConnectionPending = true
      } else {
        void this.connectOnStartup()
      }
    })
  }

  async updateCache(showError = true, runtime?: ControllerRuntime) {
    const controllerRuntime = runtime ?? (await interfaceService.buildControllerRuntime(showError))

    if (!controllerRuntime) {
      return false
    }

    const ipc = await serverService.ensureServer()
    return (await ipc?.updateController(controllerRuntime)) ?? false
  }

  connectOnStartup(): Promise<boolean> {
    if (this.startupConnection) {
      return this.startupConnection
    }

    const connection = this.connectOnStartupImpl()
      .catch(err => {
        logger.error(`startup controller connection failed: ${err}`)
        return false
      })
      .finally(() => {
        this.startupConnection = undefined
        if (this.startupConnectionPending) {
          this.startupConnectionPending = false
          void this.connectOnStartup()
        }
      })
    this.startupConnection = connection
    return connection
  }

  private async connectOnStartupImpl() {
    const config = vscode.workspace.getConfiguration('maa')
    const autoDetectOnStartup = config.get<boolean>('controller.autoDetectOnStartup', false)
    if (!config.get<boolean>('controller.connectOnStartup', false) && !autoDetectOnStartup) {
      return false
    }

    const activeResource = rootService.activeResource
    if (!activeResource) {
      return false
    }
    const resourceKey = this.resourceKey(activeResource)
    await interfaceService.waitForLoad()
    if (!this.isResourceCurrent(resourceKey)) {
      return false
    }

    let runtime = await interfaceService.buildControllerRuntime(false)
    if (!this.isResourceCurrent(resourceKey)) {
      return false
    }
    if (runtime && (await this.updateCache(false, runtime))) {
      if (!this.isResourceCurrent(resourceKey)) {
        return false
      }
      logger.info('startup controller connected')
      return true
    }

    if (!autoDetectOnStartup) {
      logger.warn('startup controller connection failed')
      return false
    }

    if (!this.isResourceCurrent(resourceKey)) {
      return false
    }
    const discovered = await this.discoverController()
    if (!discovered) {
      logger.warn('startup controller auto-detection found no unique controller')
      return false
    }

    if (!this.isResourceCurrent(resourceKey)) {
      return false
    }
    runtime = await interfaceService.buildControllerRuntime(false, discovered)
    if (!runtime) {
      logger.warn('startup controller runtime could not be rebuilt after auto-detection')
      return false
    }
    if (!this.isResourceCurrent(resourceKey)) {
      return false
    }
    if (!(await this.updateCache(false, runtime))) {
      logger.warn('startup controller connection failed after auto-detection')
      return false
    }
    if (!this.isResourceCurrent(resourceKey)) {
      return false
    }
    await interfaceService.reduceConfig(discovered)

    logger.info('startup controller auto-detected and connected')
    return true
  }

  private resourceKey(resource: NonNullable<typeof rootService.activeResource>) {
    return `${resource.workspace.fsPath}\0${resource.interfaceRelative}`
  }

  private isResourceCurrent(resourceKey: string) {
    const current = rootService.activeResource
    if (!current || this.resourceKey(current) !== resourceKey) {
      this.startupConnectionPending = true
      return false
    }
    return true
  }

  private async discoverController(): Promise<InterfaceConfig | null> {
    const config = interfaceService.interfaceConfigJson
    const controller = interfaceService.interfaceJson.controller?.find(
      info => info.name === config.controller
    )
    if (!controller) {
      return null
    }

    const ipc = await serverService.ensureServer()
    if (!ipc) {
      return null
    }

    if (controller.type === 'Adb') {
      const current = config.adb
      const devices = (await ipc.refreshAdb(current?.adb_path)) ?? []
      if (devices.length !== 1) {
        return null
      }

      const device = devices[0]
      const matchesCurrent = current?.adb_path === device[1] && current?.address === device[2]
      if (matchesCurrent && this.hasCompleteAdbConfig(current)) {
        return null
      }

      let deviceConfig: unknown
      try {
        deviceConfig = JSON.parse(device[5])
      } catch {
        return null
      }
      return {
        adb: {
          adb_path: device[1],
          address: device[2],
          screencap: device[3],
          input: device[4],
          config: deviceConfig
        }
      }
    }

    if (controller.type !== 'Win32' && controller.type !== 'Gamepad') {
      return null
    }

    const devices = (await ipc.refreshDesktop()) ?? []
    const desktop = controller.type === 'Win32' ? controller.win32 : controller.gamepad
    const filters: ((device: maa.DesktopDevice) => boolean)[] = []
    if (desktop?.class_regex) {
      let classRegex: RegExp
      try {
        classRegex = new RegExp(desktop.class_regex)
      } catch {
        return null
      }
      filters.push(device => classRegex.test(device[1]))
    }
    if (desktop?.window_regex) {
      let windowRegex: RegExp
      try {
        windowRegex = new RegExp(desktop.window_regex)
      } catch {
        return null
      }
      filters.push(device => windowRegex.test(device[2]))
    }

    const matches = devices.filter(device => filters.every(filter => filter(device)))
    const key: 'win32' | 'gamepad' = controller.type === 'Win32' ? 'win32' : 'gamepad'
    const current = key === 'win32' ? config.win32?.hwnd : config.gamepad?.hwnd
    if (current && matches.some(device => device[0] === current)) {
      return null
    }
    if (matches.length !== 1) {
      return null
    }

    return key === 'win32'
      ? {
          win32: {
            hwnd: matches[0][0]
          }
        }
      : {
          gamepad: {
            hwnd: matches[0][0]
          }
        }
  }

  private hasCompleteAdbConfig(config: InterfaceConfig['adb']) {
    return (
      !!config &&
      typeof config.adb_path === 'string' &&
      config.adb_path.length > 0 &&
      typeof config.address === 'string' &&
      config.address.length > 0 &&
      config.screencap !== undefined &&
      config.input !== undefined &&
      config.config !== undefined
    )
  }

  async setupInstance(runtime: InterfaceRuntime): Promise<[boolean, string]> {
    if (!(await this.updateCache())) {
      return [false, t('maa.debug.init-controller-failed')]
    }

    const timeout =
      (vscode.workspace.getConfiguration('maa').get('agentTimeout') as number | undefined) ?? 30000

    const ipc = await serverService.ensureServer()
    const result = (await ipc?.setupInstance(runtime, timeout)) ?? { error: 'ipc error' }
    if (result.error || !result.handle) {
      return [false, result.error ?? 'no handle']
    }

    return [true, result.handle]
  }

  async launchRuntime(
    runtime: InterfaceRuntime,
    tasks?: InterfaceRuntime['task'],
    presentation: { revealLog?: boolean; preserveFocus?: boolean } = {}
  ) {
    if (presentation.revealLog !== false) {
      loggerChannel.show(true)
    }
    try {
      await this.launchRuntimeImpl(runtime, tasks, presentation.preserveFocus ?? false)
    } catch (err) {
      logger.error(`${err}`)
    }
  }

  async launchRuntimeImpl(
    runtime: InterfaceRuntime,
    tasks?: InterfaceRuntime['task'],
    preserveFocus = false
  ) {
    if (runtime.controller.permission_required && !serverService.rpc.admin) {
      vscode.window.showWarningMessage(t('maa.pi.warning.require-admin'))
    }

    const ipc = await serverService.ensureServer()
    if (!ipc) {
      return
    }

    const session = await debugService.startSession()

    let abort = false
    session.handleTerminate = async () => {
      abort = true
    }

    const [setupSuccess, errorOrHandle] = await this.setupInstance(runtime)

    if (abort) {
      return
    }

    if (!setupSuccess) {
      session.pushMessage(errorOrHandle)
      session.pushTerminated()
      return
    }

    // if (!this.tasker) {
    //   session.pushMessage(t('maa.debug.init-instance-failed'))
    //   session.pushTerminated()
    //   return
    // }

    session.pushMessage(t('maa.debug.init-instance-succeeded'))
    session.pushContinued()

    const panel = new WebviewLaunchPanel(
      ipc,
      errorOrHandle,
      runtime.root,
      'Maa Launch',
      undefined,
      preserveFocus
    )
    serverService.instMap[errorOrHandle] = panel
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

    for (const task of (tasks ?? runtime.task).tasks) {
      session.pushMessage(t('maa.debug.task-started', task.name, task.entry))
      const succeeded =
        (await ipc.postTask(
          errorOrHandle,
          task.entry,
          task.pipeline_override as Record<string, unknown>[]
        )) ?? false
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
