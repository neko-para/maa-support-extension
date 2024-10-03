import * as maa from '@nekosu/maa-node'
import * as vscode from 'vscode'

import { commands } from '../command'
import { Service } from '../data'
import { t } from '../locale'
import { PipelineProjectInterfaceProvider } from '../pipeline/pi'
import { PipelineRootStatusProvider } from '../pipeline/root'
import { PipelineTaskIndexProvider } from '../pipeline/task'
import { JSONStringify } from '../utils/json-bigint'
import {
  configController,
  configTask,
  selectController,
  selectExistTask,
  selectResource,
  selectTask
} from './configure'
import { Interface, InterfaceConfig, InterfaceRuntime } from './type'
import { ProjectInterfaceWebProvider } from './web'

type TaskerCache = {
  tasker: maa.TaskerBase
  resource: maa.ResourceBase
  controller: maa.ControllerBase
}

function serializeRuntime(runtime: InterfaceRuntime) {
  return JSONStringify(runtime)
}

export async function initConfig(data: Interface): Promise<InterfaceConfig | null> {
  const newConfig: Partial<InterfaceConfig> = {}

  const ctrlRes = await selectController(data)

  if (!ctrlRes) {
    return null
  }

  newConfig.controller = ctrlRes

  const ctrlCfg = await configController(data, ctrlRes.name)

  if (!ctrlCfg) {
    return null
  }

  Object.assign(newConfig, ctrlCfg)

  const resRes = await selectResource(data)

  if (!resRes) {
    return null
  }

  newConfig.resource = resRes

  newConfig.task = []

  const taskRes = await selectTask(data)

  if (taskRes) {
    const taskCfg = await configTask(data, taskRes)
    if (taskCfg) {
      newConfig.task.push({
        name: taskRes,
        option: taskCfg
      })
    }
  }

  return newConfig as InterfaceConfig
}

export class ProjectInterfaceLaunchProvider extends Service {
  outputChannel: vscode.OutputChannel
  tasker: TaskerCache | null
  instanceConfig: string | null

  constructor(context: vscode.ExtensionContext) {
    super(context)

    this.outputChannel = vscode.window.createOutputChannel('Maa')
    this.tasker = null
    this.instanceConfig = null

    this.defer = vscode.commands.registerCommand(commands.StopLaunch, async () => {
      this.tasker?.tasker?.post_stop()
    })

    this.defer = vscode.commands.registerCommand(commands.LaunchInterface, async () => {
      const pip = this.shared(PipelineProjectInterfaceProvider)

      if (!pip.interfaceJson) {
        return
      }

      if (!pip.interfaceConfigJson) {
        const way = await vscode.window.showQuickPick(
          [t('maa.pi.item.empty-config'), t('maa.pi.item.interactive-setup-config')].map(
            (label, index) => ({
              label,
              index
            })
          ),
          {
            title: t('maa.pi.title.init-config')
          }
        )

        if (!way) {
          return
        }

        if (way.index === 0) {
          pip.interfaceConfigJson = {
            controller: pip.interfaceJson.controller[0],
            resource: pip.interfaceJson.resource[0].name,
            task: []
          }
        } else {
          const newConfig = await initConfig(pip.interfaceJson)
          if (!newConfig) {
            return
          }
          pip.interfaceConfigJson = newConfig
        }

        pip.updateConfigStatus()
        await pip.saveInterface()
      }
      while (pip.interfaceJson && pip.interfaceConfigJson) {
        const actions: {
          label: string
          action: () => Promise<boolean>
        }[] = [
          {
            label: t('maa.pi.entry.switch-controller'),
            action: async () => {
              const ctrlRes = await selectController(pip.interfaceJson!)

              if (!ctrlRes) {
                return false
              }

              pip.interfaceConfigJson!.controller = ctrlRes

              const ctrlCfg = await configController(pip.interfaceJson!, ctrlRes.name)

              if (!ctrlCfg) {
                return false
              }

              Object.assign(pip.interfaceConfigJson!, ctrlCfg)

              await pip.saveInterface()
              return true
            }
          },
          {
            label: t('maa.pi.entry.switch-resource'),
            action: async () => {
              const resRes = await selectResource(pip.interfaceJson!)

              if (!resRes) {
                return false
              }

              pip.interfaceConfigJson!.resource = resRes

              await pip.saveInterface()
              return true
            }
          },
          {
            label: t('maa.pi.entry.add-task'),
            action: async () => {
              const taskRes = await selectTask(pip.interfaceJson!)

              if (!taskRes) {
                return false
              }

              const taskCfg = await configTask(pip.interfaceJson!, taskRes)

              if (!taskCfg) {
                return false
              }

              pip.interfaceConfigJson!.task.push({
                name: taskRes,
                option: taskCfg
              })

              await pip.saveInterface()
              return true
            }
          },
          {
            label: t('maa.pi.entry.move-task'),
            action: async () => {
              const taskRes = await selectExistTask(pip.interfaceJson!, pip.interfaceConfigJson!)

              if (taskRes === null) {
                return false
              }

              const removedTask = pip.interfaceConfigJson!.task.splice(taskRes, 1)

              const newTaskRes = await vscode.window.showQuickPick(
                pip
                  .interfaceConfigJson!.task.map((x, i) => ({
                    label: `Before ${i}. ${x.name}`,
                    index: i
                  }))
                  .concat({
                    label: 'After last task',
                    index: pip.interfaceConfigJson!.task.length
                  })
              )

              if (!newTaskRes) {
                pip.interfaceConfigJson!.task.splice(taskRes, 0, ...removedTask)
                return false
              }

              pip.interfaceConfigJson!.task.splice(newTaskRes.index, 0, ...removedTask)

              await pip.saveInterface()
              return true
            }
          },
          {
            label: t('maa.pi.entry.remove-task'),
            action: async () => {
              const taskRes = await selectExistTask(pip.interfaceJson!, pip.interfaceConfigJson!)

              if (taskRes === null) {
                return false
              }

              pip.interfaceConfigJson!.task.splice(taskRes, 1)

              await pip.saveInterface()
              return true
            }
          },
          {
            label: t('maa.pi.entry.launch'),
            action: async () => {
              const runtime = await this.prepareRuntime(
                this.shared(PipelineRootStatusProvider).activateResource!.dirUri.fsPath
              )

              console.log(runtime)

              if (runtime) {
                this.outputChannel.show(true)
                try {
                  await this.launchRuntime(runtime)
                } catch (err) {
                  this.outputChannel.append(`${err}\n`)
                }
              }

              return true
            }
          }
        ]

        const action = await vscode.window.showQuickPick(actions, {
          title: t('maa.pi.title.choose-action')
        })

        if (!action) {
          return
        }

        if (!(await action.action())) {
          return null
        }
      }
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

      const runtime = await this.prepareRuntime(
        this.shared(PipelineRootStatusProvider).activateResource!.dirUri.fsPath
      )

      console.log(runtime)

      if (runtime) {
        this.outputChannel.show(true)
        try {
          await this.launchTask(runtime, task)
        } catch (err) {
          this.outputChannel.append(`${err}\n`)
        }
      }

      return true
    })
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
    for (const task of config.task) {
      const taskInfo = data.task.find(x => x.name === task.name)

      if (!taskInfo) {
        await vscode.window.showErrorMessage(t('maa.pi.error.cannot-find-task', task.name))
        return null
      }

      const param: {} = {}

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

      // 看看FW代码里面这玩意在前面还是后面
      Object.assign(param, taskInfo.pipeline_override ?? {})

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

    let controller: maa.ControllerBase

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

    const piwp = this.shared(ProjectInterfaceWebProvider)
    ;(await piwp.acquire()).reveal(vscode.ViewColumn.Two, false)
    piwp.post({
      cmd: 'launch.setup'
    })

    const oldNotify = this.tasker.tasker.notify
    this.tasker.tasker.notify = async (msg, details) => {
      await oldNotify(msg, details)
      piwp.post(
        {
          cmd: 'launch.notify',
          msg,
          details
        },
        false
      )
    }

    await this.tasker.tasker.post_pipeline(task).wait()
  }

  async launchRuntime(runtime: InterfaceRuntime) {
    if (!(await this.setupInstance(runtime)) || !this.tasker) {
      return
    }

    const piwp = this.shared(ProjectInterfaceWebProvider)
    ;(await piwp.acquire()).reveal(vscode.ViewColumn.Two, false)
    piwp.post({
      cmd: 'launch.setup'
    })

    const oldNotify = this.tasker.tasker.notify
    this.tasker.tasker.notify = async (msg, details) => {
      await oldNotify(msg, details)
      piwp.post(
        {
          cmd: 'launch.notify',
          msg,
          details
        },
        false
      )
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
