import { t } from '@nekosu/maa-locale'

import type { ParsedInterface } from '../interface/types'
import type {
  ControllerRuntime,
  ControllerValidationError,
  InterfaceConfig,
  MaaEnvs
} from './types'

/**
 * 纯验证——检查 controller config 是否有效。
 * 不访问 maa.* 全局变量，webview 可安全调用。
 */
export function validateControllerConfig(
  data: ParsedInterface,
  config: InterfaceConfig
): ControllerValidationError[] {
  const errors: ControllerValidationError[] = []
  const ctrlName = config.controller ?? '<unknown>'

  if (!config.controller) {
    errors.push({ type: 'missing-controller', controller: ctrlName })
    return errors
  }

  if (config.controller === '$fixed') {
    if (!config.vscFixed?.image) {
      errors.push({ type: 'missing-vsc-fixed-image', controller: ctrlName })
    }
    return errors
  }

  const ctrlInfo = data.controller[config.controller]
  if (!ctrlInfo) {
    errors.push({ type: 'missing-controller', controller: ctrlName })
    return errors
  }

  switch (ctrlInfo.type) {
    case 'Adb':
      if (!config.adb) {
        errors.push({ type: 'missing-adb-config', controller: ctrlName })
      }
      break
    case 'Win32':
      if (!config.win32) {
        errors.push({ type: 'missing-win32-config', controller: ctrlName })
      } else if (!config.win32.hwnd) {
        errors.push({ type: 'missing-hwnd', controller: ctrlName })
      }
      break
    case 'PlayCover':
      if (!config.playcover) {
        errors.push({ type: 'missing-playcover-config', controller: ctrlName })
      } else if (!config.playcover.address) {
        errors.push({ type: 'missing-playcover-address', controller: ctrlName })
      }
      break
    case 'Gamepad':
      if (!config.gamepad) {
        errors.push({ type: 'missing-gamepad-config', controller: ctrlName })
      } else if (!config.gamepad.hwnd) {
        errors.push({ type: 'missing-hwnd', controller: ctrlName })
      }
      break
    default:
      errors.push({ type: 'unknown-controller-type', controller: ctrlName })
  }

  return errors
}

function fixNum(v?: string | number, dic?: Record<string, string>): string | number | undefined {
  if (typeof v === 'number') {
    return `${v}`
  } else if (dic && typeof v === 'string' && v in dic) {
    return dic[v]
  } else {
    return v
  }
}

/**
 * 构建 ControllerRuntime——内部调用 validateControllerConfig 验证，
 * 再使用 MaaEnvs 构建运行时参数。仅 extension 使用。
 */
export function buildControllerRuntime(
  data: ParsedInterface,
  config: InterfaceConfig,
  envs: MaaEnvs
): ControllerRuntime | string {
  if (config.controller === '$fixed') {
    if (!config.vscFixed?.image) {
      return t('maa.pi.error.cannot-find-controller', config.controller ?? '<unknown>')
    }

    return {
      name: '$fixed',
      type: 'vscFixed',
      args: [config.vscFixed.image],
      display_raw: true
    }
  }

  const ctrlInfo = data.controller[config.controller ?? '']

  if (!ctrlInfo) {
    return t('maa.pi.error.cannot-find-controller', config.controller ?? '<unknown>')
  }

  const baseOption = {
    name: config.controller ?? '',
    display_short_side: ctrlInfo.display_short_side,
    display_long_side: ctrlInfo.display_long_side,
    display_raw: ctrlInfo.display_raw,
    permission_required: ctrlInfo.permission_required,
    attach_resource_path: ctrlInfo.attach_resource_path?.map(x =>
      (x as string).replaceAll('{PROJECT_DIR}', '.')
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
        fixNum(ctrlInfo.win32?.screencap, envs.Win32ScreencapMethod) ??
          envs.Win32ScreencapMethod.FramePool,
        fixNum(ctrlInfo.win32?.mouse, envs.Win32InputMethod) ??
          envs.Win32InputMethod.SendMessageWithCursorPos,
        fixNum(ctrlInfo.win32?.keyboard, envs.Win32InputMethod) ?? envs.Win32InputMethod.SendMessage
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
        fixNum(ctrlInfo.gamepad?.screencap, envs.Win32ScreencapMethod) ??
          envs.Win32ScreencapMethod.FramePool,
        fixNum(ctrlInfo.gamepad?.gamepad_type, envs.GamepadType) ?? envs.GamepadType.Xbox360
      ],
      ...baseOption
    }
  }

  return `Unknown controller type ${(ctrlInfo as { type?: string })?.type}`
}
