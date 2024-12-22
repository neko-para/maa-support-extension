import * as vscode from 'vscode'

import { logger, loggerChannel, t, vscfs } from '@mse/utils'

import { commands } from '../command'
import { Service } from '../data'
import { Maa, maa } from '../maa'
import { PipelineRootStatusProvider } from '../pipeline/root'
import { PipelineTaskIndexProvider } from '../pipeline/task'
import { focusAndWaitPanel, useControlPanel } from '../web'
import { ProjectInterfaceLaunchInstance } from '../webview/launch'
import { ProjectInterfaceJsonProvider } from './json'
import { InterfaceRuntime } from './type'

type InstanceCache = {
  controller: Maa.ControllerBase
}

export type TaskerInstance = {
  tasker: Maa.TaskerBase
  resource: Maa.ResourceBase
  controller: Maa.ControllerBase
}

function serializeRuntimeCache(runtime: InterfaceRuntime['controller_param']) {
  return JSON.stringify(runtime)
}

export class ProjectInterfaceLaunchProvider extends Service {
  cache: InstanceCache | null
  cacheConfig: string | null
  tasker: TaskerInstance | null

  constructor() {
    super()

    this.cache = null
    this.cacheConfig = null
    this.tasker = null

    this.defer = vscode.commands.registerCommand(commands.LaunchInterface, async () => {
      // await this.launchInterface()
      const { post } = useControlPanel()
      await focusAndWaitPanel()

      logger.info(`Send launch interface request`)
      post({
        cmd: 'launchInterface'
      })

      return true
    })

    this.defer = vscode.commands.registerCommand(commands.LaunchTask, async (task?: string) => {
      if (!task) {
        const taskRes = await vscode.window.showQuickPick(
          await this.shared(PipelineTaskIndexProvider).queryTaskList(),
          {
            title: t('maa.pi.title.select-task')
          }
        )
        if (!taskRes) {
          return false
        }
        task = taskRes
      }

      const { post } = useControlPanel()
      await focusAndWaitPanel()

      logger.info(`Send launch task request ${task}`)
      post({
        cmd: 'launchTask',
        task
      })

      return true
    })

    this.defer = vscode.commands.registerCommand(commands.GenerateMSEIndex, async () => {
      const mseDir = vscode.Uri.joinPath(
        this.shared(PipelineRootStatusProvider).activateResource.value!.dirUri,
        '.mse'
      )
      const mseIndex = vscode.Uri.joinPath(mseDir, 'index.js')
      if (!(await vscfs.exists(mseIndex))) {
        await vscfs.createDirectory(mseDir)
        await vscfs.copy(
          vscode.Uri.joinPath(this.context.extensionUri, 'data', 'index.js'),
          mseIndex
        )
      }
    })
  }

  async launchInterface(runtime: InterfaceRuntime) {
    if (runtime) {
      loggerChannel.show(true)
      try {
        await this.launchRuntime(runtime)
      } catch (err) {
        logger.error(`${err}`)
      }
    }
  }

  async prepareControllerRuntime(): Promise<InterfaceRuntime['controller_param'] | null> {
    const pip = this.shared(ProjectInterfaceJsonProvider)
    const data = pip.interfaceJson.value
    const config = pip.interfaceConfigJson.value
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

  async updateCache(): Promise<boolean> {
    const rt = await this.prepareControllerRuntime()

    if (!rt) {
      return false
    }

    const key = serializeRuntimeCache(rt)

    if (key !== this.cacheConfig) {
      // use auto release via gc. ProjectInterfaceLaunchInstance refer it
      // this.cache?.controller?.destroy()
      this.cache = null
      this.cacheConfig = null
    }

    let controller: Maa.ControllerBase | undefined = this.cache?.controller

    if (controller) {
      return true
    }

    if (rt.ctype === 'adb') {
      controller = new maa.AdbController(rt.adb_path, rt.address, rt.screencap, rt.input, rt.config)
    } else if (rt.ctype === 'win32') {
      controller = new maa.Win32Controller(rt.hwnd, rt.screencap, rt.input)
    } else {
      return false
    }

    controller.notify = (msg, detail) => {
      logger.info(`${msg} ${detail}`)
    }

    await controller.post_connection().wait()

    if (controller.connected) {
      this.cache = { controller }
      this.cacheConfig = key
      return true
    } else {
      controller.destroy()
      return false
    }
  }

  async setupInstance(runtime: InterfaceRuntime): Promise<boolean> {
    this.tasker?.tasker.destroy()
    this.tasker?.resource.destroy()
    this.tasker = null

    if (!(await this.updateCache())) {
      return false
    }

    const controller = this.cache?.controller

    if (!controller) {
      return false
    }

    const resource = new maa.Resource()

    resource.notify = (msg, detail) => {
      logger.info(`${msg} ${detail}`)
    }

    for (const path of runtime.resource_path) {
      await resource.post_path(path).wait()
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
      return false
    }

    this.tasker = {
      tasker: tasker,
      controller,
      resource
    }

    const mseDir = vscode.Uri.joinPath(
      this.shared(PipelineRootStatusProvider).activateResource.value!.dirUri,
      '.mse'
    )
    const mseIndex = vscode.Uri.joinPath(mseDir, 'index.js')
    if (await vscfs.exists(mseIndex)) {
      try {
        delete require.cache[mseIndex.fsPath]
        const module = require(mseIndex.fsPath)
        module(controller, resource, tasker, logger)
      } catch (err) {
        logger.warn(`load mse failed, error ${err}`)
      }
    }

    return true
  }

  async launchTask(runtime: InterfaceRuntime, task: string) {
    if (!(await this.setupInstance(runtime)) || !this.tasker) {
      return
    }

    const tasker = this.tasker
    this.tasker = null
    await new ProjectInterfaceLaunchInstance(tasker).setup()
    await tasker.tasker.post_pipeline(task).wait()
  }

  async launchRuntime(runtime: InterfaceRuntime) {
    if (!(await this.setupInstance(runtime)) || !this.tasker) {
      return
    }

    const tasker = this.tasker
    this.tasker = null
    await new ProjectInterfaceLaunchInstance(tasker).setup()
    let last
    for (const task of runtime.task) {
      last = tasker.tasker
        .post_pipeline(task.entry, task.pipeline_override as unknown as any)
        .wait()
    }
    await last
  }
}
