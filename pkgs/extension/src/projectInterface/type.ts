import type maa from '@maaxyz/maa-node'

export type InterfaceRuntime = {
  controller_param:
    | {
        ctype: 'adb'
        adb_path: string
        address: string
        screencap: maa.api.ScreencapOrInputMethods
        input: maa.api.ScreencapOrInputMethods
        config: string
      }
    | {
        ctype: 'win32'
        hwnd: maa.api.DesktopHandle
        screencap: maa.api.ScreencapOrInputMethods
        input: maa.api.ScreencapOrInputMethods
      }
  resource_path: string[]
  task: {
    name: string
    entry: string
    pipeline_override: unknown
  }[]
  // gpu: number
}
