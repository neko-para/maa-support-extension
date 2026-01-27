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

    return await serverService.updateCtrl(runtime)
  }

  async setupInstance(runtime: InterfaceRuntime): Promise<[boolean, string]> {
    if (!(await this.updateCache())) {
      return [false, t('maa.debug.init-controller-failed')]
    }

    const result = await serverService.setupInst(runtime)
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
    const session = await debugService.startSession()

    const [setupSuccess, errorOrHandle] = await this.setupInstance(runtime)

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

    const panel = new WebviewLaunchPanel(errorOrHandle, 'maa launch')
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
      // const succeeded = await tasker.tasker
      //   .post_task(task.entry, mergeParams(task.pipeline_override))
      //   .wait().succeeded
      // session.pushMessage(
      //   succeeded
      //     ? t('maa.debug.task-finished', task.name, task.entry)
      //     : t('maa.debug.task-failed', task.name, task.entry)
      // )
    }
    panel.finish()

    session.pushExited()
  }
}
