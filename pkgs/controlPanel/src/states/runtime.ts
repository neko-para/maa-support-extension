import { computed } from 'vue'

import type { InterfaceRuntime } from '@mse/types'

import { ipc } from '@/main'

import * as controllerSt from './controller'
import * as interfaceSt from './interface'
import * as resourceSt from './resource'

export const runtime = computed<[InterfaceRuntime, null] | [null, string]>(() => {
  const root = ipc.context.value.interfaceProjectDir
  const maaEnum = ipc.context.value.maaEnum
  if (!root || !maaEnum) {
    return [null, 'inner error']
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

  result.resource_path = resInfo.path.map(replaceVar)

  result.task = []
  for (const task of config.task ?? []) {
    const taskInfo = data.task?.find(x => x.name === task.name)

    if (!taskInfo) {
      return [null, 'no task']
    }

    const param: {} = {}

    Object.assign(param, taskInfo.pipeline_override ?? {})

    // 是不是该检查一下task里面指定的option是否都被配置了？如果缺失的话看看要不要读下default
    for (const opt of task.option ?? []) {
      const optInfo = data.option?.[opt.name]

      if (!optInfo) {
        return [null, 'no option']
      }

      const csInfo = optInfo.cases.find(x => x.name === opt.value)

      if (!csInfo) {
        return [null, 'no case']
      }

      Object.assign(param, csInfo.pipeline_override ?? {})
    }

    result.task.push({
      name: task.name,
      entry: taskInfo.entry,
      pipeline_override: param
    })
  }

  return [result as InterfaceRuntime, null]
})

export function runtimeForTask(task: string) {
  const [rt, err] = runtime.value
  if (rt) {
    const nrt = structuredClone(rt)
    nrt.task = [
      {
        name: task,
        entry: task,
        pipeline_override: {}
      }
    ]
    return nrt
  }
}
