import * as maa from '@nekosu/maa-node'
import * as vscode from 'vscode'

import { commands } from '../command'
import { Service } from '../data'
import { currentWorkspace, exists } from '../utils/fs'
import { Interface, InterfaceConfig, InterfaceRuntime } from './type'

type RemoveUndefined<T> = T extends undefined ? never : T

async function selectController(data: Interface): Promise<InterfaceConfig['controller'] | null> {
  const ctrlRes = await vscode.window.showQuickPick(
    data.controller.map(ctrl => {
      return {
        label: ctrl.name
      } satisfies vscode.QuickPickItem
    }),
    {
      title: 'Select controller'
    }
  )

  if (!ctrlRes) {
    return null
  }

  const ctrlInfo = data.controller.find(x => x.name === ctrlRes.label)

  if (!ctrlInfo) {
    await vscode.window.showErrorMessage(`Cannot find controller ${ctrlRes.label}`)
    return null
  }

  return {
    name: ctrlRes.label,
    type: ctrlInfo.type
  }
}

async function configController(
  data: Interface,
  ctrlName: string
): Promise<Pick<InterfaceConfig, 'adb' | 'win32'> | null> {
  const ctrlInfo = data.controller.find(x => x.name === ctrlName)

  if (!ctrlInfo) {
    await vscode.window.showErrorMessage(`Cannot find controller ${ctrlName}`)
    return null
  }

  if (ctrlInfo.type === 'Adb') {
    const devices = await maa.AdbController.find()

    if (!devices) {
      await vscode.window.showErrorMessage('No devices found')
      return null
    }

    const devRes = await vscode.window.showQuickPick(
      devices.map((dev, idx): vscode.QuickPickItem & { index: number } => {
        return {
          label: dev.name,
          description: `${dev.name} - ${dev.adb_serial} - ${dev.adb_path}`,
          index: idx
        }
      }),
      {
        title: 'Select device'
      }
    )

    if (!devRes) {
      return null
    }

    const dev = devices[devRes.index]

    return {
      adb: {
        adb_path: dev.adb_path,
        address: dev.adb_serial,
        config: JSON.parse(dev.adb_config)
      }
    }
  } else {
    // TODO:
  }

  return null
}

type TaskConfig = RemoveUndefined<InterfaceConfig['task'][number]['option']>
async function configTask(data: Interface, taskName: string): Promise<TaskConfig | null> {
  const task = data.task.find(x => x.name === taskName)

  if (!task) {
    await vscode.window.showErrorMessage(`Cannot find task ${taskName}`)
    return null
  }

  const result: TaskConfig = []
  for (const optName of task.option ?? []) {
    const opt = data.option?.[optName]
    if (!opt) {
      await vscode.window.showErrorMessage(`Cannot find option ${optName}`)
      return null
    }

    const optRes = await vscode.window.showQuickPick(
      opt.cases.map(cs => {
        return {
          label: cs.name,
          description: opt.default_case === cs.name ? 'default' : undefined
        } satisfies vscode.QuickPickItem
      }),
      {
        title: `Select option ${optName}`
      }
    )

    if (!optRes) {
      return null
    }

    result.push({
      name: optName,
      value: optRes.label
    })
  }

  return result
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

  const resRes = await vscode.window.showQuickPick(
    data.resource.map(res => {
      return {
        label: res.name,
        description: res.path.join('; ')
      } satisfies vscode.QuickPickItem
    }),
    {
      title: 'Select resource'
    }
  )

  if (!resRes) {
    return null
  }

  const resInfo = data.resource.find(x => x.name === resRes.label)

  if (!resInfo) {
    await vscode.window.showErrorMessage(`Cannot find resource ${resRes.label}`)
    return null
  }

  newConfig.resource = resRes.label

  newConfig.task = []

  const taskRes = await vscode.window.showQuickPick(
    data.task.map(task => {
      return {
        label: task.name,
        description: task.entry
      } satisfies vscode.QuickPickItem
    }),
    {
      title: 'Select task'
    }
  )

  if (taskRes) {
    const taskCfg = await configTask(data, taskRes.label)
    if (taskCfg) {
      newConfig.task.push({
        name: taskRes.label,
        option: taskCfg
      })
    }
  }

  return newConfig as InterfaceConfig
}

function overwriteConfig(
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
      adb_controller_type: overwriteConfig(
        maa.AdbControllerType.Input_Preset_AutoDetect |
          maa.AdbControllerType.Screencap_FastestLosslessWay,
        ctrlInfo.adb?.touch ?? null,
        ctrlInfo.adb?.key ?? null,
        ctrlInfo.adb?.screencap ?? null
      )
    }
  } else {
    return null
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
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Maa: Project Interface Launching...'
        },
        async progress => {
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
            ? JSON.parse((await vscode.workspace.fs.readFile(interfaceConfigUri)).toString())
            : null

          const saveConfig = async (cfg: InterfaceConfig) => {
            await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(root, 'install/config'))
            await vscode.workspace.fs.writeFile(
              interfaceConfigUri,
              Buffer.from(JSON.stringify(cfg, null, 4))
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
          while (true) {
            const action = await vscode.window.showQuickPick(
              ['Switch controller', 'Launch!'].map(x => ({
                label: x
              })),
              {
                title: 'Choose action'
              }
            )
            if (!action) {
              return
            }

            switch (action.label) {
              case 'Switch controller': {
                const ctrlRes = await selectController(interfaceData)

                if (!ctrlRes) {
                  return null
                }

                interfaceConfigData.controller = ctrlRes

                const ctrlCfg = await configController(interfaceData, ctrlRes.name)

                if (!ctrlCfg) {
                  return null
                }

                Object.assign(interfaceConfigData, ctrlCfg)

                await saveConfig(interfaceConfigData)

                break
              }
              case 'Launch!': {
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

                break
              }
            }
          }
        }
      )
    })
  }
}
