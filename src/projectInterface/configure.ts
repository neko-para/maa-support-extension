import * as maa from '@nekosu/maa-node'
import * as vscode from 'vscode'

import { commands } from '../command'
import { Service } from '../data'
import { currentWorkspace, exists } from '../utils/fs'
import { Interface, InterfaceConfig, InterfaceRuntime } from './type'

type RemoveUndefined<T> = T extends undefined ? never : T

export async function selectController(
  data: Interface
): Promise<InterfaceConfig['controller'] | null> {
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

export async function configController(
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

export async function selectResource(data: Interface): Promise<InterfaceConfig['resource'] | null> {
  const resRes = await vscode.window.showQuickPick(
    data.resource.map(res => {
      return {
        label: res.name
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

  return resRes.label
}

export async function selectTask(data: Interface): Promise<string | null> {
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

  if (!taskRes) {
    return null
  }

  return taskRes.label
}

export async function selectExistTask(
  data: Interface,
  config: InterfaceConfig
): Promise<number | null> {
  const taskRes = await vscode.window.showQuickPick(
    config.task.map((x, i) => ({
      label: `${i}. ${x.name}`,
      index: i
    }))
  )

  return taskRes?.index ?? null
}

type TaskConfig = RemoveUndefined<InterfaceConfig['task'][number]['option']>
export async function configTask(data: Interface, taskName: string): Promise<TaskConfig | null> {
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
