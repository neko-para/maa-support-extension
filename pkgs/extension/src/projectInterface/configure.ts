import * as maa from '@maaxyz/maa-node'
import * as vscode from 'vscode'

import { t } from '@mse/utils'

import { Interface, InterfaceConfig } from './type'

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
      title: t('maa.pi.title.select-controller')
    }
  )

  if (!ctrlRes) {
    return null
  }

  const ctrlInfo = data.controller.find(x => x.name === ctrlRes.label)

  if (!ctrlInfo) {
    await vscode.window.showErrorMessage(t('maa.pi.error.cannot-find-controller', ctrlRes.label))
    return null
  }

  return {
    name: ctrlRes.label
  }
}

export async function configController(
  data: Interface,
  ctrlName: string
): Promise<Pick<InterfaceConfig, 'adb' | 'win32'> | null> {
  const ctrlInfo = data.controller.find(x => x.name === ctrlName)

  if (!ctrlInfo) {
    await vscode.window.showErrorMessage(t('maa.pi.error.cannot-find-controller', ctrlName))
    return null
  }

  if (ctrlInfo.type === 'Adb') {
    const devices = await maa.AdbController.find()

    if (!devices) {
      await vscode.window.showErrorMessage(t('maa.pi.error.no-devices-found'))
      return null
    }

    const devRes = await vscode.window.showQuickPick(
      devices.map(([name, adb_path, adb_serial], idx): vscode.QuickPickItem & { index: number } => {
        return {
          label: name,
          description: `${name} - ${adb_serial} - ${adb_path}`,
          index: idx
        }
      }),
      {
        title: t('maa.pi.title.select-device')
      }
    )

    if (!devRes) {
      return null
    }

    const [name, adb_path, adb_serial, screencap_methods, input_methods, adb_config] =
      devices[devRes.index]

    return {
      adb: {
        adb_path: adb_path,
        address: adb_serial,
        config: JSON.parse(adb_config)
      }
    }
  } else if (ctrlInfo.type === 'Win32') {
    if (!ctrlInfo.win32) {
      await vscode.window.showErrorMessage(t('maa.pi.error.no-win32-config-provided'))
      return null
    }

    const allWnds = (await maa.Win32Controller.find()) ?? []
    let hwnds = allWnds

    if (ctrlInfo.win32.window_regex) {
      const reg = new RegExp(ctrlInfo.win32.window_regex)
      hwnds = hwnds.filter(x => reg.test(x[2]))
    }

    if (ctrlInfo.win32.class_regex) {
      const reg = new RegExp(ctrlInfo.win32.class_regex)
      hwnds = hwnds.filter(x => reg.test(x[1]))
    }

    const hwndRes = await vscode.window.showQuickPick(
      hwnds.map(([handle, class_name, window_name]) => {
        return {
          label: `${handle} - ${class_name} - ${window_name}`,
          hwnd: handle
        }
      }),
      {
        title: t('maa.pi.title.select-window')
      }
    )

    if (!hwndRes) {
      return null
    }

    return {
      win32: {
        hwnd: hwndRes.hwnd
      }
    }
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
      title: t('maa.pi.title.select-resource')
    }
  )

  if (!resRes) {
    return null
  }

  const resInfo = data.resource.find(x => x.name === resRes.label)

  if (!resInfo) {
    await vscode.window.showErrorMessage(t('maa.pi.error.cannot-find-resource', resRes.label))
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
      title: t('maa.pi.title.select-task')
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
    await vscode.window.showErrorMessage(t('maa.pi.error.cannot-find-task', taskName))
    return null
  }

  const result: TaskConfig = []
  for (const optName of task.option ?? []) {
    const opt = data.option?.[optName]
    if (!opt) {
      await vscode.window.showErrorMessage(t('maa.pi.error.cannot-find-option', optName))
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
        title: t('maa.pi.title.select-option', optName)
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
