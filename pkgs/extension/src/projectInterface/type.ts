import { Maa } from '../maa'

export type InterfaceRuntime = {
  controller_param:
    | {
        ctype: 'adb'
        adb_path: string
        address: string
        screencap: Maa.api.ScreencapOrInputMethods
        input: Maa.api.ScreencapOrInputMethods
        config: string
      }
    | {
        ctype: 'win32'
        hwnd: Maa.api.DesktopHandle
        screencap: Maa.api.ScreencapOrInputMethods
        input: Maa.api.ScreencapOrInputMethods
      }
  resource_path: string[]
  task: {
    name: string
    entry: string
    pipeline_override: unknown
  }[]
  // gpu: number
}
