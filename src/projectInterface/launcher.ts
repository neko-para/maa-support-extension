import * as maa from '@nekosu/maa-node'
import * as vscode from 'vscode'

import { commands } from '../command'
import { Service } from '../data'
import { currentWorkspace, exists } from '../utils/fs'
import {
  configController,
  configTask,
  selectController,
  selectExistTask,
  selectResource,
  selectTask
} from './configure'
import { Interface, InterfaceConfig, InterfaceRuntime } from './type'

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

function overwriteTKSConfig(
  base: number,
  touch: number | null,
  key: number | null,
  screencap: number | null
) {
  const base_touch = base & 0xff
  const base_key = (base >> 8) & 0xff
  const base_screencap = (base >> 16) & 0xff
  return (touch ?? base_touch) | ((key ?? base_key) << 8) | ((screencap ?? base_screencap) << 16)
}

export async function prepareRuntime(
  data: Interface,
  config: InterfaceConfig,
  root: string // overwrite PROJECT_DIR
): Promise<InterfaceRuntime | null> {
  const result: Partial<InterfaceRuntime> = {}

  const ctrlInfo = data.controller.find(x => x.name === config.controller.name)

  if (!ctrlInfo) {
    await vscode.window.showErrorMessage(`Cannot find controller ${config.controller.name}`)
    return null
  }

  if (ctrlInfo.type === 'Adb') {
    if (!config.adb) {
      await vscode.window.showErrorMessage(
        `Cannot find adb config for controller ${config.controller.name}`
      )
      return null
    }

    result.controller_param = {
      ctype: 'adb',
      adb_path: config.adb.adb_path,
      adb_serial: config.adb.address,
      adb_config: JSON.stringify(ctrlInfo.adb?.config ?? config.adb.config),
      adb_controller_type: overwriteTKSConfig(
        maa.AdbControllerType.Input_Preset_AutoDetect |
          maa.AdbControllerType.Screencap_FastestLosslessWay,
        ctrlInfo.adb?.touch ?? null,
        ctrlInfo.adb?.key ?? null,
        ctrlInfo.adb?.screencap ?? null
      )
    }
  } else if (ctrlInfo.type === 'Win32') {
    if (!config.win32) {
      await vscode.window.showErrorMessage(
        `Cannot find win32 config for controller ${config.controller.name}`
      )
      return null
    }

    if (!config.win32.hwnd) {
      await vscode.window.showErrorMessage(
        `Cannot find hwnd in win32 config for controller ${config.controller.name}, please reconfigure the controller`
      )
      return null
    }

    result.controller_param = {
      ctype: 'win32',
      hwnd: config.win32.hwnd,
      controller_type: overwriteTKSConfig(
        maa.Win32ControllerType.Touch_Seize |
          maa.Win32ControllerType.Key_Seize |
          maa.Win32ControllerType.Screencap_DXGI_DesktopDup,
        ctrlInfo.win32?.touch ?? null,
        ctrlInfo.win32?.key ?? null,
        ctrlInfo.win32?.screencap ?? null
      )
    }
  }

  const resInfo = data.resource.find(x => x.name === config.resource)

  if (!resInfo) {
    await vscode.window.showErrorMessage(`Cannot find resource ${config.resource}`)
    return null
  }

  result.resource_path = resInfo.path.map(x => x.replace('{PROJECT_DIR}', root))

  result.task = []
  for (const task of config.task) {
    const taskInfo = data.task.find(x => x.name === task.name)

    if (!taskInfo) {
      await vscode.window.showErrorMessage(`Cannot find task ${task.name}`)
      return null
    }

    const param: {} = {}

    // 是不是该检查一下task里面指定的option是否都被配置了？如果缺失的话看看要不要读下default
    for (const opt of task.option ?? []) {
      const optInfo = data.option?.[opt.name]

      if (!optInfo) {
        await vscode.window.showErrorMessage(`Cannot find option ${opt.name}`)
        return null
      }

      const csInfo = optInfo.cases.find(x => x.name === opt.value)

      if (!csInfo) {
        await vscode.window.showErrorMessage(`Cannot find case ${opt.value} for option ${opt.name}`)
        return null
      }

      Object.assign(param, csInfo.param ?? {})
    }

    // 看看FW代码里面这玩意在前面还是后面
    Object.assign(param, taskInfo.param ?? {})

    result.task.push({
      name: task.name,
      entry: taskInfo.entry,
      param: param
    })
  }

  return result as InterfaceRuntime
}

export async function launchRuntime(runtime: InterfaceRuntime, output: vscode.OutputChannel) {
  let controller: maa.ControllerBase

  if (runtime.controller_param.ctype === 'adb') {
    controller = new maa.AdbController(runtime.controller_param)
  } else if (runtime.controller_param.ctype === 'win32') {
    controller = new maa.Win32Controller(
      runtime.controller_param.hwnd,
      runtime.controller_param.controller_type
    )
  } else {
    return
  }

  controller.notify = (msg, detail) => {
    output.append(`${msg} ${detail}\n`)
  }

  await controller.post_connection()

  const resource = new maa.Resource()

  resource.notify = (msg, detail) => {
    output.append(`${msg} ${detail}\n`)
  }

  for (const path of runtime.resource_path) {
    await resource.post_path(path)
  }

  const instance = new maa.Instance()

  instance.notify = (msg, detail) => {
    output.append(`${msg} ${detail}\n`)
  }

  instance.bind(controller)
  instance.bind(resource)

  if (!instance.inited) {
    instance.destroy()
    controller.destroy()
    resource.destroy()
    return
  }

  for (const task of runtime.task) {
    await instance.post_task(task.entry, task.param as unknown as maa.PipelineDecl).wait()
  }
}

export class ProjectInterfaceLaunchProvider extends Service {
  outputChannel: vscode.OutputChannel

  constructor(context: vscode.ExtensionContext) {
    super(context)

    this.outputChannel = vscode.window.createOutputChannel('Maa')

    this.defer = vscode.commands.registerCommand(commands.LaunchInterface, async () => {
      const root = currentWorkspace()
      if (!root) {
        return
      }

      const interfaceUri = vscode.Uri.joinPath(root, 'assets/interface.json')
      const interfaceConfigUri = vscode.Uri.joinPath(root, 'install/config/maa_pi_config.json')

      if (!(await exists(interfaceUri))) {
        return
      }

      const interfaceData = JSON.parse(
        (await vscode.workspace.fs.readFile(interfaceUri)).toString()
      )
      let interfaceConfigData = (await exists(interfaceConfigUri))
        ? (JSON.parse(
            (await vscode.workspace.fs.readFile(interfaceConfigUri)).toString()
          ) as InterfaceConfig)
        : null

      const saveConfig = async (cfg: InterfaceConfig) => {
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(root, 'install/config'))
        await vscode.workspace.fs.writeFile(
          interfaceConfigUri,
          Buffer.from(
            JSON.stringify(
              cfg,
              (key, value) => {
                if (key === 'hwnd') {
                  return undefined
                }
                return value
              },
              4
            )
          )
        )
      }

      if (!interfaceConfigData) {
        const newConfig = await initConfig(interfaceData)
        if (!newConfig) {
          return
        }
        await saveConfig(newConfig)
        interfaceConfigData = newConfig
      }
      while (interfaceConfigData) {
        const actions: {
          label: string
          action: () => Promise<boolean>
        }[] = [
          {
            label: 'Switch controller',
            action: async () => {
              const ctrlRes = await selectController(interfaceData)

              if (!ctrlRes) {
                return false
              }

              interfaceConfigData.controller = ctrlRes

              const ctrlCfg = await configController(interfaceData, ctrlRes.name)

              if (!ctrlCfg) {
                return false
              }

              Object.assign(interfaceConfigData, ctrlCfg)

              await saveConfig(interfaceConfigData)
              return true
            }
          },
          {
            label: 'Switch resource',
            action: async () => {
              const resRes = await selectResource(interfaceData)

              if (!resRes) {
                return false
              }

              interfaceConfigData.resource = resRes

              await saveConfig(interfaceConfigData)
              return true
            }
          },
          {
            label: 'Add task',
            action: async () => {
              const taskRes = await selectTask(interfaceData)

              if (!taskRes) {
                return false
              }

              const taskCfg = await configTask(interfaceData, taskRes)

              if (!taskCfg) {
                return false
              }

              interfaceConfigData.task.push({
                name: taskRes,
                option: taskCfg
              })

              await saveConfig(interfaceConfigData)
              return true
            }
          },
          {
            label: 'Move task',
            action: async () => {
              const taskRes = await selectExistTask(interfaceData, interfaceConfigData)

              if (taskRes === null) {
                return false
              }

              const removedTask = interfaceConfigData.task.splice(taskRes, 1)

              const newTaskRes = await vscode.window.showQuickPick(
                interfaceConfigData.task
                  .map((x, i) => ({
                    label: `Before ${i}. ${x.name}`,
                    index: i
                  }))
                  .concat({
                    label: 'After last task',
                    index: interfaceConfigData.task.length
                  })
              )

              if (!newTaskRes) {
                interfaceConfigData.task.splice(taskRes, 0, ...removedTask)
                return false
              }

              interfaceConfigData.task.splice(newTaskRes.index, 0, ...removedTask)

              await saveConfig(interfaceConfigData)
              return true
            }
          },
          {
            label: 'Remove task',
            action: async () => {
              const taskRes = await selectExistTask(interfaceData, interfaceConfigData)

              if (taskRes === null) {
                return false
              }

              interfaceConfigData.task.splice(taskRes, 1)

              await saveConfig(interfaceConfigData)
              return true
            }
          },
          {
            label: 'Launch!',
            action: async () => {
              const runtime = await prepareRuntime(
                interfaceData,
                interfaceConfigData,
                vscode.Uri.joinPath(root, 'assets').fsPath
              )

              console.log(runtime)

              if (runtime) {
                this.outputChannel.show(true)
                try {
                  await launchRuntime(runtime, this.outputChannel)
                } catch (err) {
                  this.outputChannel.append(`${err}\n`)
                }
              }

              return true
            }
          }
        ]

        const action = await vscode.window.showQuickPick(actions, {
          title: 'Choose action'
        })

        if (!action) {
          return
        }

        if (!(await action.action())) {
          return null
        }
      }
    })
  }
}
