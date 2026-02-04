import { existsSync } from 'fs'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as vscode from 'vscode'

import { InterfaceRuntime } from '@mse/types'
import { logger, loggerChannel, t } from '@mse/utils'

import { debugService, interfaceService, serverService } from '.'
import { currentWorkspace } from '../utils/fs'
import { BaseService } from './context'
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
  constructor() {
    super()
    console.log('construct LaunchService')
  }

  async init() {
    console.log('init LaunchService')
  }

  async updateCache() {
    const runtime = interfaceService.buildControllerRuntime()

    if (!runtime) {
      return false
    }

    const ipc = await serverService.ensureServer()
    return (await ipc?.updateController(runtime)) ?? false
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

  async launchRuntime(runtime: InterfaceRuntime, tasks?: InterfaceRuntime['task']) {
    loggerChannel.show(true)
    try {
      await this.launchRuntimeImpl(runtime, tasks)
    } catch (err) {
      logger.error(`${err}`)
    }
  }

  async launchRuntimeImpl(runtime: InterfaceRuntime, tasks?: InterfaceRuntime['task']) {
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

    const panel = new WebviewLaunchPanel(ipc, errorOrHandle, 'maa launch')
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

    for (const task of tasks ?? runtime.task) {
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
