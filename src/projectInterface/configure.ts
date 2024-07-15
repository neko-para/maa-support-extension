import * as maa from '@nekosu/maa-node'
import * as vscode from 'vscode'

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
      title: vscode.l10n.t('maa.pi.title.select-controller')
    }
  )

  if (!ctrlRes) {
    return null
  }

  const ctrlInfo = data.controller.find(x => x.name === ctrlRes.label)

  if (!ctrlInfo) {
    await vscode.window.showErrorMessage(
      vscode.l10n.t('maa.pi.error.cannot-find-controller', ctrlRes.label)
    )
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
    await vscode.window.showErrorMessage(
      vscode.l10n.t('maa.pi.error.cannot-find-controller', ctrlName)
    )
    return null
  }

  if (ctrlInfo.type === 'Adb') {
    const devices = await maa.AdbController.find()

    if (!devices) {
      await vscode.window.showErrorMessage(vscode.l10n.t('maa.pi.error.no-devices-found'))
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
        title: vscode.l10n.t('maa.pi.title.select-device')
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
  } else if (ctrlInfo.type === 'Win32') {
    if (!ctrlInfo.win32) {
      await vscode.window.showErrorMessage(vscode.l10n.t('maa.pi.error.no-win32-config-provided'))
      return null
    }

    let hwnds: maa.Win32Hwnd[]
    switch (ctrlInfo.win32.method) {
      case 'Find':
        hwnds = maa.Win32Controller.find(
          'find',
          ctrlInfo.win32.class_name ?? '',
          ctrlInfo.win32.window_name ?? ''
        )
        break
      case 'Search':
        hwnds = maa.Win32Controller.find(
          'search',
          ctrlInfo.win32.class_name ?? '',
          ctrlInfo.win32.window_name ?? ''
        )
        break
      case 'Cursor':
        hwnds = [maa.Win32Controller.get('cursor')]
        break
      case 'Desktop':
        hwnds = [maa.Win32Controller.get('desktop')]
        break
      case 'Foreground':
        hwnds = [maa.Win32Controller.get('foreground')]
        break
    }

    const hwndRes = await vscode.window.showQuickPick(
      hwnds.map(hwnd => {
        const info = maa.Win32Controller.info(hwnd)
        return {
          label: `${maa.get_window_hwnd(hwnd)} - ${info.class_name} - ${info.window_name}`,
          hwnd: hwnd
        }
      }),
      {
        title: vscode.l10n.t('maa.pi.title.select-window')
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
      title: vscode.l10n.t('maa.pi.title.select-resource')
    }
  )

  if (!resRes) {
    return null
  }

  const resInfo = data.resource.find(x => x.name === resRes.label)

  if (!resInfo) {
    await vscode.window.showErrorMessage(
      vscode.l10n.t('maa.pi.error.cannot-find-resource', resRes.label)
    )
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
      title: vscode.l10n.t('maa.pi.title.select-task')
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
    await vscode.window.showErrorMessage(vscode.l10n.t('maa.pi.error.cannot-find-task', taskName))
    return null
  }

  const result: TaskConfig = []
  for (const optName of task.option ?? []) {
    const opt = data.option?.[optName]
    if (!opt) {
      await vscode.window.showErrorMessage(
        vscode.l10n.t('maa.pi.error.cannot-find-option', optName)
      )
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
        title: vscode.l10n.t('maa.pi.title.select-option', optName)
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
