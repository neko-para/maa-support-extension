import { computed } from 'vue'

import type { InterfaceRuntime } from '@mse/types'

import { ipc } from '@/control/main'

import * as controllerSt from './controller'
import * as interfaceSt from './interface'
import * as resourceSt from './resource'

export const runtime = computed<[InterfaceRuntime, null] | [null, string]>(() => {
  const root = ipc.context.value.interfaceProjectDir
  const maaEnum = ipc.context.value.maaEnum
  if (!root) {
    return [null, 'inner error, no root, consider restart']
  }
  if (!maaEnum) {
    ipc.postMessage({
      cmd: '__updateMaaEnum'
    })
    return [null, 'inner error, no maaEnum, consider restart']
  }

  const data = interfaceSt.currentObj.value
  const config = interfaceSt.currentConfigObj.value

  if (!data || !config) {
    return [null, 'interface or config not available']
  }

  const replaceVar = (x: string) => {
    return x.replaceAll('{PROJECT_DIR}', root)
  }

  const result: Partial<InterfaceRuntime> = {}

  result.root = root

  const ctrlInfo = controllerSt.currentProto.value

  if (!ctrlInfo) {
    return [null, 'no controller']
  }

  if (ctrlInfo.type === 'Adb') {
    if (!config.adb) {
      return [null, 'no adb config']
    }

    result.controller_param = {
      ctype: 'adb',
      adb_path: config.adb.adb_path,
      address: config.adb.address,
      config: JSON.stringify(ctrlInfo.adb?.config ?? config.adb.config),
      screencap: ctrlInfo.adb?.screencap ?? maaEnum.AdbScreencapMethod.Default,
      input: ctrlInfo.adb?.input ?? maaEnum.AdbInputMethod.Default
    }
  } else if (ctrlInfo.type === 'Win32') {
    if (!config.win32) {
      return [null, 'no win32 config']
    }

    if (!config.win32.hwnd) {
      return [null, 'no hwnd']
    }

    result.controller_param = {
      ctype: 'win32',
      hwnd: config.win32.hwnd,
      screencap: ctrlInfo.win32?.screencap ?? maaEnum.Win32ScreencapMethod.DXGI_DesktopDup,
      input: ctrlInfo.win32?.input ?? maaEnum.Win32InputMethod.Seize
    }
  }

  const resInfo = resourceSt.currentProto.value

  if (!resInfo) {
    return [null, 'no resource']
  }

  result.resource_path = (typeof resInfo.path === 'string' ? [resInfo.path] : resInfo.path).map(
    replaceVar
  )

  result.task = []
  for (const task of config.task ?? []) {
    const taskInfo = data.task?.find(x => x.name === task.name)

    ipc.log.debug(`process taskInfo ${JSON.stringify(taskInfo)}`)

    if (!taskInfo) {
      return [null, 'no task']
    }

    const param: {} = {}

    Object.assign(param, taskInfo.pipeline_override ?? {})

    for (const optName of taskInfo.option ?? []) {
      const optInfo = data.option?.[optName]

      if (!optInfo) {
        return [null, 'no option']
      }

      const optEntry = task.option?.find(x => x.name === optName)

      const optValue = optEntry?.value ?? optInfo.default_case ?? optInfo.cases[0].name

      const csInfo = optInfo.cases.find(x => x.name === optValue)

      if (!csInfo) {
        return [null, 'no case']
      }

      Object.assign(param, csInfo.pipeline_override ?? {})
    }

    ipc.log.debug(`process taskInfo param result ${JSON.stringify(param)}`)

    result.task.push({
      name: task.name,
      entry: taskInfo.entry,
      pipeline_override: param
    })
  }

  if (data.agent) {
    result.agent = {
      child_exec: data.agent.child_exec ? replaceVar(data.agent.child_exec) : undefined,
      child_args: data.agent.child_args?.map(replaceVar),
      identifier: data.agent.identifier
    }
  }

  return [result as InterfaceRuntime, null]
})

export function runtimeForTask(task: string) {
  ipc.log.info(`Build runtime for task ${task}`)
  const [rt, err] = runtime.value
  if (rt) {
    const nrt = JSON.parse(JSON.stringify(rt))
    nrt.task = [
      {
        name: task,
        entry: task,
        pipeline_override: {}
      }
    ]
    return nrt
  } else {
    ipc.log.error(`Build runtime for task ${task} failed, error ${err}`)
  }
}
