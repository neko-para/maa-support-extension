import { t } from '@nekosu/maa-locale'

import type { ControllerRuntime, ControllerRuntimeBase, Interface, InterfaceConfig } from '../types'

export interface ControllerRuntimeConstants {
  Win32ScreencapMethod: typeof maa.Win32ScreencapMethod
  Win32InputMethod: typeof maa.Win32InputMethod
  GamepadType: typeof maa.GamepadType
}

export function buildControllerRuntime(
  data: Interface,
  config: InterfaceConfig,
  constants: ControllerRuntimeConstants = maa
): ControllerRuntime | string {
  if (config.controller === '$fixed') {
    if (!config.vscFixed) {
      return 'No vscFixed for controller'
    }

    if (!config.vscFixed.image) {
      return 'No vscFixed image for controller'
    }

    return {
      name: '$fixed',

      type: 'vscFixed',
      args: [config.vscFixed.image],

      display_raw: true
    }
  }

  const ctrlInfo = data.controller?.find(x => x.name === config.controller)

  if (!ctrlInfo) {
    return t('maa.pi.error.cannot-find-controller', config.controller ?? '<unknown>')
  }

  const fixNum = (v?: string | number, dic?: Record<string, string>) => {
    if (typeof v === 'number') {
      return `${v}`
    } else if (dic && typeof v === 'string' && v in dic) {
      return dic[v]
    } else {
      return v
    }
  }

  const baseOption: ControllerRuntimeBase = {
    name: ctrlInfo.name,

    display_short_side: ctrlInfo.display_short_side,
    display_long_side: ctrlInfo.display_long_side,
    display_raw: ctrlInfo.display_raw,
    permission_required: ctrlInfo.permission_required,
    attach_resource_path: ctrlInfo.attach_resource_path?.map(x =>
      x.replaceAll('{PROJECT_DIR}', '.')
    ),
    option: ctrlInfo.option
  }

  if (ctrlInfo.type === 'Adb') {
    if (!config.adb) {
      return t('maa.pi.error.cannot-find-adb-for-controller', config.controller ?? '<unknown>')
    }

    return {
      type: 'adb',
      args: [
        config.adb.adb_path,
        config.adb.address,
        config.adb.screencap,
        config.adb.input,
        JSON.stringify(config.adb.config)
      ],

      ...baseOption
    }
  } else if (ctrlInfo.type === 'Win32') {
    if (!config.win32) {
      return t('maa.pi.error.cannot-find-win32-for-controller', config.controller ?? '<unknown>')
    }

    if (!config.win32.hwnd) {
      return t('maa.pi.error.cannot-find-hwnd-for-controller', config.controller ?? '<unknown>')
    }

    return {
      type: 'win32',
      args: [
        config.win32.hwnd,

        fixNum(ctrlInfo.win32?.screencap, constants.Win32ScreencapMethod) ??
          constants.Win32ScreencapMethod.FramePool,

        fixNum(ctrlInfo.win32?.mouse, constants.Win32InputMethod) ??
          constants.Win32InputMethod.SendMessageWithCursorPos,

        fixNum(ctrlInfo.win32?.keyboard, constants.Win32InputMethod) ??
          constants.Win32InputMethod.SendMessage
      ],

      ...baseOption
    }
  } else if (ctrlInfo.type === 'PlayCover') {
    if (!config.playcover) {
      return t(
        'maa.pi.error.cannot-find-playcover-for-controller',
        config.controller ?? '<unknown>'
      )
    }

    if (!config.playcover?.address) {
      return t('maa.pi.error.cannot-find-address-for-controller', config.controller ?? '<unknown>')
    }

    return {
      type: 'playcover',
      args: [config.playcover.address, 'maa.playcover'],

      ...baseOption
    }
  } else if (ctrlInfo.type === 'Gamepad') {
    if (!config.gamepad) {
      return t('maa.pi.error.cannot-find-gamepad-for-controller', config.controller ?? '<unknown>')
    }

    if (!config.gamepad.hwnd) {
      return t('maa.pi.error.cannot-find-hwnd-for-controller', config.controller ?? '<unknown>')
    }

    return {
      type: 'gamepad',
      args: [
        config.gamepad.hwnd,

        fixNum(ctrlInfo.gamepad?.screencap, constants.Win32ScreencapMethod) ??
          constants.Win32ScreencapMethod.FramePool,
        fixNum(ctrlInfo.gamepad?.gamepad_type, constants.GamepadType) ??
          constants.GamepadType.Xbox360
      ],

      ...baseOption
    }
  }

  return `Unknown controller type ${(ctrlInfo as { type?: string })?.type}`
}
