import { watch } from 'reactive-vscode'
import * as vscode from 'vscode'

import { Interface, InterfaceConfig } from '@mse/types'
import { t } from '@mse/utils'

import { commands } from '../command'
import { Service } from '../data'
import { useControlPanel, useOldWebPanel } from '../extension'
import { Maa, maa } from '../maa'
import { PipelineProjectInterfaceProvider } from '../pipeline/pi'
import { PipelineRootStatusProvider } from '../pipeline/root'
import { PipelineTaskIndexProvider } from '../pipeline/task'
import { InterfaceRuntime } from './type'

type TaskerCache = {
  tasker: Maa.TaskerBase
  resource: Maa.ResourceBase
  controller: Maa.ControllerBase
}

function serializeRuntime(runtime: InterfaceRuntime) {
  return JSON.stringify(runtime)
}

export class ProjectInterfaceLaunchProvider extends Service {
  outputChannel: vscode.OutputChannel
  tasker: TaskerCache | null
  instanceConfig: string | null

  constructor() {
    super()

    this.outputChannel = vscode.window.createOutputChannel('Maa')
    this.tasker = null
    this.instanceConfig = null

    this.defer = vscode.commands.registerCommand(commands.StopLaunch, async () => {
      this.tasker?.tasker?.post_stop()
    })

    this.defer = vscode.commands.registerCommand(commands.LaunchInterface, async () => {
      await this.launchInterface()
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
          return
        }
        task = taskRes
      }

      const { post, visible, awakeListener } = useControlPanel()

      console.log('maa: launch task control panel visible', visible.value)

      if (!visible.value) {
        console.log('maa: launch task focus panel')
        vscode.commands.executeCommand('maa.view.control-panel.focus')

        awakeListener.value.push(() => {
          console.log('maa: launch task send request')
          post({
            cmd: 'launchTask',
            task
          })
        })
      } else {
        console.log('maa: launch task send request')
        post({
          cmd: 'launchTask',
          task
        })
      }

      return true
    })
  }

  async launchInterface(runtime?: InterfaceRuntime | null) {
    if (!runtime) {
      runtime = await this.prepareRuntime(
        this.shared(PipelineRootStatusProvider).activateResource!.dirUri.fsPath
      )
    }

    console.log(runtime)

    if (runtime) {
      this.outputChannel.show(true)
      try {
        await this.launchRuntime(runtime)
      } catch (err) {
        this.outputChannel.append(`${err}\n`)
      }
    }
  }

  async prepareRuntime(
    root: string // overwrite PROJECT_DIR
  ): Promise<InterfaceRuntime | null> {
    const pip = this.shared(PipelineProjectInterfaceProvider)
    const data = pip.interfaceJson
    const config = pip.interfaceConfigJson

    if (!data || !config) {
      return null
    }

    const replaceVar = (x: string) => {
      return x.replaceAll('{PROJECT_DIR}', root)
    }

    const result: Partial<InterfaceRuntime> = {}

    const ctrlInfo = data.controller.find(x => x.name === config.controller.name)

    if (!ctrlInfo) {
      await vscode.window.showErrorMessage(
        t('maa.pi.error.cannot-find-controller', config.controller.name)
      )
      return null
    }

    if (ctrlInfo.type === 'Adb') {
      if (!config.adb) {
        await vscode.window.showErrorMessage(
          t('maa.pi.error.cannot-find-adb-for-controller', config.controller.name)
        )
        return null
      }

      result.controller_param = {
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
          t('maa.pi.error.cannot-find-win32-for-controller', config.controller.name)
        )
        return null
      }

      if (!config.win32.hwnd) {
        await vscode.window.showErrorMessage(
          t('maa.pi.error.cannot-find-hwnd-for-controller', config.controller.name)
        )
        return null
      }

      result.controller_param = {
        ctype: 'win32',
        hwnd: config.win32.hwnd,
        screencap: ctrlInfo.win32?.screencap ?? maa.api.Win32ScreencapMethod.DXGI_DesktopDup,
        input: ctrlInfo.win32?.input ?? maa.api.Win32InputMethod.Seize
      }
    }

    const resInfo = data.resource.find(x => x.name === config.resource)

    if (!resInfo) {
      await vscode.window.showErrorMessage(t('maa.pi.error.cannot-find-resource', config.resource))
      return null
    }

    result.resource_path = resInfo.path.map(replaceVar)

    result.task = []
    for (const task of config.task ?? []) {
      const taskInfo = data.task.find(x => x.name === task.name)

      if (!taskInfo) {
        await vscode.window.showErrorMessage(t('maa.pi.error.cannot-find-task', task.name))
        return null
      }

      const param: {} = {}

      Object.assign(param, taskInfo.pipeline_override ?? {})

      // 是不是该检查一下task里面指定的option是否都被配置了？如果缺失的话看看要不要读下default
      for (const opt of task.option ?? []) {
        const optInfo = data.option?.[opt.name]

        if (!optInfo) {
          await vscode.window.showErrorMessage(t('maa.pi.error.cannot-find-option', opt.name))
          return null
        }

        const csInfo = optInfo.cases.find(x => x.name === opt.value)

        if (!csInfo) {
          await vscode.window.showErrorMessage(
            t('maa.pi.error.cannot-find-case-for-option', opt.value, opt.name)
          )
          return null
        }

        Object.assign(param, csInfo.pipeline_override ?? {})
      }

      result.task.push({
        name: task.name,
        entry: taskInfo.entry,
        pipeline_override: param
      })
    }

    return result as InterfaceRuntime
  }

  async setupInstance(runtime: InterfaceRuntime, useCache = false): Promise<boolean> {
    const key = serializeRuntime(runtime)

    if (useCache) {
      if (key === this.instanceConfig) {
        return true
      }
    }

    this.tasker = null
    this.instanceConfig = null

    let controller: Maa.ControllerBase

    if (runtime.controller_param.ctype === 'adb') {
      const p = runtime.controller_param
      controller = new maa.AdbController(p.adb_path, p.address, p.screencap, p.input, p.config)
    } else if (runtime.controller_param.ctype === 'win32') {
      const p = runtime.controller_param
      controller = new maa.Win32Controller(p.hwnd, p.screencap, p.input)
    } else {
      return false
    }

    controller.notify = (msg, detail) => {
      this.outputChannel.append(`${msg} ${detail}\n`)
    }

    await controller.post_connection().wait()

    const resource = new maa.Resource()

    resource.notify = (msg, detail) => {
      this.outputChannel.append(`${msg} ${detail}\n`)
    }

    for (const path of runtime.resource_path) {
      await resource.post_path(path).wait()
    }

    const tasker = new maa.Tasker()

    tasker.notify = (msg, detail) => {
      this.outputChannel.append(`${msg} ${detail}\n`)
    }

    tasker.bind(controller)
    tasker.bind(resource)

    if (!tasker.inited) {
      tasker.destroy()
      controller.destroy()
      resource.destroy()
      return false
    }

    this.tasker = {
      tasker: tasker,
      controller,
      resource
    }
    this.instanceConfig = key

    return true
  }

  async launchTask(runtime: InterfaceRuntime, task: string) {
    if (!(await this.setupInstance(runtime)) || !this.tasker) {
      return
    }

    const { post, visible } = await useOldWebPanel(vscode.ViewColumn.Two)

    visible.value = true
    post({
      cmd: 'launch.setup'
    })

    const oldNotify = this.tasker.tasker.notify
    this.tasker.tasker.notify = async (msg, details) => {
      await oldNotify(msg, details)
      post({
        cmd: 'launch.notify',
        msg,
        details
      })
    }

    await this.tasker.tasker.post_pipeline(task).wait()
  }

  async launchRuntime(runtime: InterfaceRuntime) {
    if (!(await this.setupInstance(runtime)) || !this.tasker) {
      return
    }

    const { post, visible } = await useOldWebPanel(vscode.ViewColumn.Two)

    visible.value = true
    post({
      cmd: 'launch.setup'
    })

    const oldNotify = this.tasker.tasker.notify
    this.tasker.tasker.notify = async (msg, details) => {
      await oldNotify(msg, details)
      post({
        cmd: 'launch.notify',
        msg,
        details
      })
    }

    let last
    for (const task of runtime.task) {
      last = this.tasker.tasker
        .post_pipeline(task.entry, task.pipeline_override as unknown as any)
        .wait()
    }
    await last
  }
}
