import { describe, expect, it } from 'vitest'

import type { ParsedInterface } from '../interface/types'
import type { RelativePath } from '../types'
import {
  buildControllerRuntime,
  buildOption,
  buildResourceRuntime,
  buildTaskRuntime,
  resolveCheckbox,
  resolveOptionConfig,
  resolveSelect,
  validateControllerConfig
} from '../runtime'
import type { InterfaceConfig, MaaEnvs, TaskConfig } from '../runtime/types'

// ═══ Test helpers ═══

const mockEnvs: MaaEnvs = {
  Win32ScreencapMethod: { FramePool: '0', DXGI: '1', GDI: '2' },
  Win32InputMethod: { SendMessage: '0', SendMessageWithCursorPos: '1', Seize: '2' },
  GamepadType: { Xbox360: '0', XboxOne: '1', DualShock4: '2' }
}

function makeInterface(overrides: Partial<ParsedInterface> = {}): ParsedInterface {
  return {
    controller: {},
    resource: {},
    task: {},
    option: {},
    preset: {},
    group: {},
    ...overrides
  }
}

function makeConfig(overrides: Partial<InterfaceConfig> = {}): InterfaceConfig {
  return { ...overrides }
}

// ═══ validateControllerConfig ═══

describe('validateControllerConfig', () => {
  it('returns error for missing controller', () => {
    const data = makeInterface()
    const config = makeConfig()
    const errors = validateControllerConfig(data, config)
    expect(errors).toHaveLength(1)
    expect(errors[0].type).toBe('missing-controller')
  })

  it('validates $fixed controller with image', () => {
    const data = makeInterface()
    const config = makeConfig({ controller: '$fixed', vscFixed: { image: '/path.png' } })
    const errors = validateControllerConfig(data, config)
    expect(errors).toHaveLength(0)
  })

  it('returns error for $fixed controller without image', () => {
    const data = makeInterface()
    const config = makeConfig({ controller: '$fixed' })
    const errors = validateControllerConfig(data, config)
    expect(errors).toHaveLength(1)
    expect(errors[0].type).toBe('missing-vsc-fixed-image')
  })

  it('returns error for non-existent controller', () => {
    const data = makeInterface()
    const config = makeConfig({ controller: 'NonExistent' })
    const errors = validateControllerConfig(data, config)
    expect(errors).toHaveLength(1)
    expect(errors[0].type).toBe('missing-controller')
  })

  it('validates Adb controller with config', () => {
    const data = makeInterface({
      controller: { AdbCtrl: { type: 'Adb' } }
    })
    const config = makeConfig({
      controller: 'AdbCtrl',
      adb: { adb_path: '/adb', address: '127.0.0.1', screencap: 0, input: 0, config: {} }
    })
    const errors = validateControllerConfig(data, config)
    expect(errors).toHaveLength(0)
  })

  it('returns error for Adb controller without adb config', () => {
    const data = makeInterface({
      controller: { AdbCtrl: { type: 'Adb' } }
    })
    const config = makeConfig({ controller: 'AdbCtrl' })
    const errors = validateControllerConfig(data, config)
    expect(errors).toHaveLength(1)
    expect(errors[0].type).toBe('missing-adb-config')
  })

  it('validates Win32 controller with hwnd', () => {
    const data = makeInterface({
      controller: { Win32Ctrl: { type: 'Win32' } }
    })
    const config = makeConfig({ controller: 'Win32Ctrl', win32: { hwnd: 12345 } })
    const errors = validateControllerConfig(data, config)
    expect(errors).toHaveLength(0)
  })

  it('returns error for Win32 controller without win32 config', () => {
    const data = makeInterface({
      controller: { Win32Ctrl: { type: 'Win32' } }
    })
    const config = makeConfig({ controller: 'Win32Ctrl' })
    const errors = validateControllerConfig(data, config)
    expect(errors).toHaveLength(1)
    expect(errors[0].type).toBe('missing-win32-config')
  })

  it('returns error for Win32 controller without hwnd', () => {
    const data = makeInterface({
      controller: { Win32Ctrl: { type: 'Win32' } }
    })
    const config = makeConfig({ controller: 'Win32Ctrl', win32: {} })
    const errors = validateControllerConfig(data, config)
    expect(errors).toHaveLength(1)
    expect(errors[0].type).toBe('missing-hwnd')
  })

  it('validates PlayCover controller with address', () => {
    const data = makeInterface({
      controller: { PCCtrl: { type: 'PlayCover' } }
    })
    const config = makeConfig({ controller: 'PCCtrl', playcover: { address: '127.0.0.1' } })
    const errors = validateControllerConfig(data, config)
    expect(errors).toHaveLength(0)
  })

  it('returns error for PlayCover controller without address', () => {
    const data = makeInterface({
      controller: { PCCtrl: { type: 'PlayCover' } }
    })
    const config = makeConfig({ controller: 'PCCtrl', playcover: { address: '' } })
    const errors = validateControllerConfig(data, config)
    expect(errors).toHaveLength(1)
    expect(errors[0].type).toBe('missing-playcover-address')
  })

  it('validates Gamepad controller with hwnd', () => {
    const data = makeInterface({
      controller: { GamepadCtrl: { type: 'Gamepad' } }
    })
    const config = makeConfig({ controller: 'GamepadCtrl', gamepad: { hwnd: 12345 } })
    const errors = validateControllerConfig(data, config)
    expect(errors).toHaveLength(0)
  })

  it('returns error for Gamepad controller without hwnd', () => {
    const data = makeInterface({
      controller: { GamepadCtrl: { type: 'Gamepad' } }
    })
    const config = makeConfig({ controller: 'GamepadCtrl', gamepad: {} })
    const errors = validateControllerConfig(data, config)
    expect(errors).toHaveLength(1)
    expect(errors[0].type).toBe('missing-hwnd')
  })

  it('returns error for unknown controller type', () => {
    const data = makeInterface({
      controller: { UnknownCtrl: { type: 'CustomType' } as never }
    })
    const config = makeConfig({ controller: 'UnknownCtrl' })
    const errors = validateControllerConfig(data, config)
    expect(errors).toHaveLength(1)
    expect(errors[0].type).toBe('unknown-controller-type')
  })
})

// ═══ buildControllerRuntime ═══

describe('buildControllerRuntime', () => {
  it('builds $fixed controller', () => {
    const data = makeInterface()
    const config = makeConfig({ controller: '$fixed', vscFixed: { image: '/path.png' } })
    const rt = buildControllerRuntime(data, config, mockEnvs)
    expect(typeof rt).not.toBe('string')
    if (typeof rt !== 'string') {
      expect(rt.type).toBe('vscFixed')
      expect(rt.args).toEqual(['/path.png'])
      expect(rt.name).toBe('$fixed')
      expect(rt.display_raw).toBe(true)
    }
  })

  it('returns error for $fixed without image', () => {
    const data = makeInterface()
    const config = makeConfig({ controller: '$fixed' })
    const rt = buildControllerRuntime(data, config, mockEnvs)
    expect(typeof rt).toBe('string')
  })

  it('builds Adb controller', () => {
    const data = makeInterface({
      controller: {
        AdbCtrl: {
          type: 'Adb',
          display_short_side: 720,
          display_long_side: 1280,
          option: ['opt1']
        }
      }
    })
    const config = makeConfig({
      controller: 'AdbCtrl',
      adb: {
        adb_path: '/usr/bin/adb',
        address: 'emulator-5554',
        screencap: 0,
        input: 1,
        config: { foo: 'bar' }
      }
    })
    const rt = buildControllerRuntime(data, config, mockEnvs)
    expect(typeof rt).not.toBe('string')
    if (typeof rt !== 'string') {
      expect(rt.type).toBe('adb')
      expect(rt.args[0]).toBe('/usr/bin/adb')
      expect(rt.args[1]).toBe('emulator-5554')
      expect(rt.name).toBe('AdbCtrl')
      expect(rt.option).toEqual(['opt1'])
    }
  })

  it('builds Win32 controller with defaults', () => {
    const data = makeInterface({
      controller: {
        Win32Ctrl: { type: 'Win32' }
      }
    })
    const config = makeConfig({
      controller: 'Win32Ctrl',
      win32: { hwnd: 12345 }
    })
    const rt = buildControllerRuntime(data, config, mockEnvs)
    expect(typeof rt).not.toBe('string')
    if (typeof rt !== 'string') {
      expect(rt.type).toBe('win32')
      expect(rt.args[0]).toBe(12345)
      expect(rt.args[1]).toBe('0') // FramePool default
      expect(rt.args[2]).toBe('1') // SendMessageWithCursorPos default
      expect(rt.args[3]).toBe('0') // SendMessage default
    }
  })

  it('builds Win32 controller with custom screencap and input methods', () => {
    const data = makeInterface({
      controller: {
        Win32Ctrl: {
          type: 'Win32',
          win32: { screencap: 'DXGI', mouse: 'Seize', keyboard: 'SendMessage' }
        }
      }
    })
    const config = makeConfig({
      controller: 'Win32Ctrl',
      win32: { hwnd: 12345 }
    })
    const rt = buildControllerRuntime(data, config, mockEnvs)
    expect(typeof rt).not.toBe('string')
    if (typeof rt !== 'string') {
      expect(rt.args[1]).toBe('1') // DXGI
      expect(rt.args[2]).toBe('2') // Seize
      expect(rt.args[3]).toBe('0') // SendMessage
    }
  })

  it('builds PlayCover controller', () => {
    const data = makeInterface({
      controller: {
        PCCtrl: { type: 'PlayCover' }
      }
    })
    const config = makeConfig({
      controller: 'PCCtrl',
      playcover: { address: '10.0.0.1' }
    })
    const rt = buildControllerRuntime(data, config, mockEnvs)
    expect(typeof rt).not.toBe('string')
    if (typeof rt !== 'string') {
      expect(rt.type).toBe('playcover')
      expect(rt.args[0]).toBe('10.0.0.1')
      expect(rt.args[1]).toBe('maa.playcover')
    }
  })

  it('builds Gamepad controller', () => {
    const data = makeInterface({
      controller: {
        GamepadCtrl: {
          type: 'Gamepad',
          gamepad: { gamepad_type: 'XboxOne' }
        }
      }
    })
    const config = makeConfig({
      controller: 'GamepadCtrl',
      gamepad: { hwnd: 99999 }
    })
    const rt = buildControllerRuntime(data, config, mockEnvs)
    expect(typeof rt).not.toBe('string')
    if (typeof rt !== 'string') {
      expect(rt.type).toBe('gamepad')
      expect(rt.args[0]).toBe(99999)
      expect(rt.args[1]).toBe('0') // FramePool default
      expect(rt.args[2]).toBe('1') // XboxOne
    }
  })

  it('returns error for non-existent controller', () => {
    const data = makeInterface()
    const config = makeConfig({ controller: 'NonExistent' })
    const rt = buildControllerRuntime(data, config, mockEnvs)
    expect(typeof rt).toBe('string')
  })

  it('returns error for Adb without adb config', () => {
    const data = makeInterface({
      controller: { AdbCtrl: { type: 'Adb' } }
    })
    const config = makeConfig({ controller: 'AdbCtrl' })
    const rt = buildControllerRuntime(data, config, mockEnvs)
    expect(typeof rt).toBe('string')
  })
})

// ═══ buildResourceRuntime ═══

describe('buildResourceRuntime', () => {
  it('builds resource with single path', () => {
    const data = makeInterface({
      resource: { Res1: { path: 'bundle1' as RelativePath, option: ['optA'] } }
    })
    const config = makeConfig({ resource: 'Res1' })
    const rt = buildResourceRuntime(data, config)
    expect(typeof rt).not.toBe('string')
    if (typeof rt !== 'string') {
      expect(rt.name).toBe('Res1')
      expect(rt.paths).toEqual(['bundle1'])
      expect(rt.option).toEqual(['optA'])
    }
  })

  it('builds resource with array path', () => {
    const data = makeInterface({
      resource: { Res1: { path: ['bundle1', 'bundle2'] as RelativePath[], option: [] } }
    })
    const config = makeConfig({ resource: 'Res1' })
    const rt = buildResourceRuntime(data, config)
    expect(typeof rt).not.toBe('string')
    if (typeof rt !== 'string') {
      expect(rt.paths).toEqual(['bundle1', 'bundle2'])
    }
  })

  it('replaces {PROJECT_DIR} in paths', () => {
    const data = makeInterface({
      resource: { Res1: { path: '{PROJECT_DIR}/assets' as RelativePath } }
    })
    const config = makeConfig({ resource: 'Res1' })
    const rt = buildResourceRuntime(data, config)
    expect(typeof rt).not.toBe('string')
    if (typeof rt !== 'string') {
      expect(rt.paths).toEqual(['./assets'])
    }
  })

  it('returns error for missing resource', () => {
    const data = makeInterface()
    const config = makeConfig({ resource: 'MissingRes' })
    const rt = buildResourceRuntime(data, config)
    expect(typeof rt).toBe('string')
  })
})

// ═══ resolveOptionConfig ═══

describe('resolveOptionConfig', () => {
  it('resolves select config', () => {
    const task: TaskConfig = { name: 'T1', option: { opt1: 'case1' } }
    expect(resolveOptionConfig(task, 'opt1', 'select')).toBe('case1')
  })

  it('returns undefined for non-string select value', () => {
    const task: TaskConfig = { name: 'T1', option: { opt1: ['a', 'b'] } }
    expect(resolveOptionConfig(task, 'opt1', 'select')).toBeUndefined()
  })

  it('resolves checkbox config', () => {
    const task: TaskConfig = { name: 'T1', option: { opt1: ['a', 'b'] } }
    expect(resolveOptionConfig(task, 'opt1', 'checkbox')).toEqual(['a', 'b'])
  })

  it('returns undefined for non-array checkbox value', () => {
    const task: TaskConfig = { name: 'T1', option: { opt1: 'a' } }
    expect(resolveOptionConfig(task, 'opt1', 'checkbox')).toBeUndefined()
  })

  it('resolves input config', () => {
    const task: TaskConfig = { name: 'T1', option: { opt1: { key: 'val' } } }
    expect(resolveOptionConfig(task, 'opt1', 'input')).toEqual({ key: 'val' })
  })

  it('returns undefined for non-object input value', () => {
    const task: TaskConfig = { name: 'T1', option: { opt1: ['a'] } }
    expect(resolveOptionConfig(task, 'opt1', 'input')).toBeUndefined()
  })

  it('returns undefined for missing option', () => {
    const task: TaskConfig = { name: 'T1' }
    expect(resolveOptionConfig(task, 'missing', 'select')).toBeUndefined()
  })
})

// ═══ resolveSelect ═══

describe('resolveSelect', () => {
  it('resolves via explicit config', () => {
    const task: TaskConfig = { name: 'T1', option: { opt1: 'caseB' } }
    const optMeta = {
      type: 'select' as const,
      cases: {
        caseA: { option: ['subA'] },
        caseB: { option: ['subB'] }
      }
    }
    const result = resolveSelect(task, 'opt1', optMeta)
    expect(result).not.toBeNull()
    expect(result!.option).toEqual(['subB'])
  })

  it('falls back to default_case', () => {
    const task: TaskConfig = { name: 'T1' }
    const optMeta = {
      type: 'select' as const,
      default_case: 'caseA',
      cases: {
        caseA: { option: ['subA'] },
        caseB: { option: ['subB'] }
      }
    }
    const result = resolveSelect(task, 'opt1', optMeta)
    expect(result).not.toBeNull()
    expect(result!.option).toEqual(['subA'])
  })

  it('falls back to first case', () => {
    const task: TaskConfig = { name: 'T1' }
    const optMeta = {
      cases: {
        caseA: { option: ['subA'] },
        caseB: { option: ['subB'] }
      }
    }
    const result = resolveSelect(task, 'opt1', optMeta)
    expect(result).not.toBeNull()
    expect(result!.option).toEqual(['subA'])
  })

  it('returns null for no cases', () => {
    const task: TaskConfig = { name: 'T1' }
    const optMeta = { cases: {} }
    const result = resolveSelect(task, 'opt1', optMeta)
    expect(result).toBeNull()
  })
})

// ═══ resolveCheckbox ═══

describe('resolveCheckbox', () => {
  it('resolves selected cases', () => {
    const task: TaskConfig = { name: 'T1', option: { opt1: ['caseA', 'caseC'] } }
    const optMeta = {
      type: 'checkbox' as const,
      cases: {
        caseA: { option: ['subA'] },
        caseB: { option: ['subB'] },
        caseC: { option: ['subC'] }
      }
    }
    const result = resolveCheckbox(task, 'opt1', optMeta)
    expect(result).toHaveLength(2)
    expect(result[0].option).toEqual(['subA'])
    expect(result[1].option).toEqual(['subC'])
  })

  it('returns empty for no selections', () => {
    const task: TaskConfig = { name: 'T1' }
    const optMeta = {
      type: 'checkbox' as const,
      cases: { caseA: { option: ['subA'] } }
    }
    const result = resolveCheckbox(task, 'opt1', optMeta)
    expect(result).toHaveLength(0)
  })
})

// ═══ buildOption ═══

describe('buildOption', () => {
  it('resolves option chain from global → controller → resource → task', () => {
    const data = makeInterface({
      global_option: ['optGlobal'],
      controller: {
        TestCtrl: {
          type: 'Adb',
          option: ['optCtrl']
        }
      },
      resource: {
        TestRes: { path: '' as RelativePath, option: ['optRes'] }
      },
      task: {
        TestTask: { entry: 'Start', option: ['optTask'] }
      },
      option: {
        optGlobal: { type: 'select' as const, cases: { default: {} } },
        optCtrl: { type: 'select' as const, cases: { default: {} } },
        optRes: { type: 'select' as const, cases: { default: {} } },
        optTask: { type: 'select' as const, cases: { default: {} } }
      }
    })
    const ctrlRt = { name: 'TestCtrl', option: ['optCtrl'] }
    const resRt = { name: 'TestRes', paths: [], option: ['optRes'] }
    const result = buildOption(data, { name: 'TestTask' }, ctrlRt, resRt)
    expect(Array.isArray(result)).toBe(true)
    if (Array.isArray(result)) {
      const names = result.map(o => o.name)
      expect(names).toContain('optGlobal')
      expect(names).toContain('optCtrl')
      expect(names).toContain('optRes')
      expect(names).toContain('optTask')
      expect(result[0].from).toBe('global')
      expect(result[1].from).toBe('controller')
      expect(result[2].from).toBe('resource')
      expect(result[3].from).toBe('task')
    }
  })

  it('resolves nested option chains', () => {
    const data = makeInterface({
      task: {
        TestTask: { entry: 'Start', option: ['optParent'] }
      },
      option: {
        optParent: {
          type: 'select' as const,
          cases: {
            caseA: { option: ['optChild'] }
          }
        },
        optChild: {
          type: 'select' as const,
          cases: { default: {} }
        }
      }
    })
    const result = buildOption(
      data,
      { name: 'TestTask', option: { optParent: 'caseA' } },
      { name: 'TestCtrl' },
      { name: 'TestRes', paths: [] }
    )
    expect(Array.isArray(result)).toBe(true)
    if (Array.isArray(result)) {
      const names = result.map(o => o.name)
      expect(names).toEqual(['optParent', 'optChild'])
    }
  })

  it('filters by controller restriction', () => {
    const data = makeInterface({
      task: {
        TestTask: { entry: 'Start', option: ['opt1'] }
      },
      option: {
        opt1: {
          type: 'select' as const,
          controller: ['OtherCtrl'],
          cases: { default: {} }
        }
      }
    })
    const result = buildOption(
      data,
      { name: 'TestTask' },
      { name: 'TestCtrl' },
      { name: 'TestRes', paths: [] }
    )
    expect(Array.isArray(result)).toBe(true)
    if (Array.isArray(result)) {
      // opt1 should be in the list but won't expand its cases
      // because controller doesn't match. However the option itself
      // should still be tracked (just not recursively resolved)
      const names = result.map(o => o.name)
      expect(names).toContain('opt1')
    }
  })

  it('filters by resource restriction', () => {
    const data = makeInterface({
      task: {
        TestTask: { entry: 'Start', option: ['opt1'] }
      },
      option: {
        opt1: {
          type: 'select' as const,
          resource: ['OtherRes'],
          cases: { default: {} }
        }
      }
    })
    const result = buildOption(
      data,
      { name: 'TestTask' },
      { name: 'TestCtrl' },
      { name: 'TestRes', paths: [] }
    )
    expect(Array.isArray(result)).toBe(true)
    if (Array.isArray(result)) {
      expect(result.map(o => o.name)).toContain('opt1')
    }
  })

  it('returns error for missing option definition', () => {
    const data = makeInterface({
      task: {
        TestTask: { entry: 'Start', option: ['optMissing'] }
      }
    })
    const result = buildOption(
      data,
      { name: 'TestTask' },
      { name: 'TestCtrl' },
      { name: 'TestRes', paths: [] }
    )
    expect(typeof result).toBe('string')
  })

  it('returns error for missing task', () => {
    const data = makeInterface()
    const result = buildOption(
      data,
      { name: 'MissingTask' },
      { name: 'TestCtrl' },
      { name: 'TestRes', paths: [] }
    )
    expect(typeof result).toBe('string')
  })

  it('avoids circular references', () => {
    const data = makeInterface({
      task: {
        TestTask: { entry: 'Start', option: ['optCircular'] }
      },
      option: {
        optCircular: {
          type: 'select' as const,
          default_case: 'caseA',
          cases: {
            caseA: { option: ['optCircular'] }
          }
        }
      }
    })
    const result = buildOption(
      data,
      { name: 'TestTask', option: { optCircular: 'caseA' } },
      { name: 'TestCtrl' },
      { name: 'TestRes', paths: [] }
    )
    expect(Array.isArray(result)).toBe(true)
    if (Array.isArray(result)) {
      expect(result).toHaveLength(1)
    }
  })
})

// ═══ buildTaskRuntime ═══

describe('buildTaskRuntime', () => {
  it('builds single task runtime', () => {
    const data = makeInterface({
      task: {
        MainTask: { entry: 'Start' }
      }
    })
    const config = makeConfig({
      task: [{ name: 'MainTask' }]
    })
    const ctrlRt = {
      name: 'TestCtrl',
      type: 'adb' as const,
      args: ['', '', 0, 0, '{}'] as [string, string, string | number, string | number, string]
    }
    const resRt = { name: 'TestRes', paths: [] }
    const result = buildTaskRuntime(data, config, ctrlRt, resRt)
    expect(typeof result).not.toBe('string')
    if (typeof result !== 'string') {
      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0].name).toBe('MainTask')
      expect(result.tasks[0].entry).toBe('Start')
    }
  })

  it('builds multiple task runtimes', () => {
    const data = makeInterface({
      task: {
        TaskA: { entry: 'EntryA' },
        TaskB: { entry: 'EntryB' }
      }
    })
    const config = makeConfig({
      task: [{ name: 'TaskA' }, { name: 'TaskB' }]
    })
    const ctrlRt = {
      name: 'Ctrl',
      type: 'adb' as const,
      args: ['', '', 0, 0, '{}'] as [string, string, string | number, string | number, string]
    }
    const resRt = { name: 'Res', paths: [] }
    const result = buildTaskRuntime(data, config, ctrlRt, resRt)
    expect(typeof result).not.toBe('string')
    if (typeof result !== 'string') {
      expect(result.tasks).toHaveLength(2)
      expect(result.tasks[0].name).toBe('TaskA')
      expect(result.tasks[1].name).toBe('TaskB')
    }
  })

  it('returns error for missing task', () => {
    const data = makeInterface()
    const config = makeConfig({
      task: [{ name: 'MissingTask' }]
    })
    const ctrlRt = {
      name: 'Ctrl',
      type: 'adb' as const,
      args: ['', '', 0, 0, '{}'] as [string, string, string | number, string | number, string]
    }
    const resRt = { name: 'Res', paths: [] }
    const result = buildTaskRuntime(data, config, ctrlRt, resRt)
    expect(typeof result).toBe('string')
  })

  it('includes pipeline_override from task', () => {
    const data = makeInterface({
      task: {
        MainTask: {
          entry: 'Start',
          pipeline_override: { custom: 'value' }
        }
      }
    })
    const config = makeConfig({
      task: [{ name: 'MainTask' }]
    })
    const ctrlRt = {
      name: 'Ctrl',
      type: 'adb' as const,
      args: ['', '', 0, 0, '{}'] as [string, string, string | number, string | number, string]
    }
    const resRt = { name: 'Res', paths: [] }
    const result = buildTaskRuntime(data, config, ctrlRt, resRt)
    expect(typeof result).not.toBe('string')
    if (typeof result !== 'string') {
      expect(result.tasks[0].pipeline_override).toHaveLength(1)
      expect(result.tasks[0].pipeline_override[0]).toEqual({ custom: 'value' })
    }
  })

  it('includes pipeline_override from resolved options', () => {
    const data = makeInterface({
      task: {
        MainTask: { entry: 'Start', option: ['opt1'] }
      },
      option: {
        opt1: {
          type: 'select' as const,
          cases: {
            caseA: { pipeline_override: { overrideKey: 'overrideVal' } }
          }
        }
      }
    })
    const config = makeConfig({
      task: [{ name: 'MainTask', option: { opt1: 'caseA' } }]
    })
    const ctrlRt = {
      name: 'Ctrl',
      type: 'adb' as const,
      args: ['', '', 0, 0, '{}'] as [string, string, string | number, string | number, string]
    }
    const resRt = { name: 'Res', paths: [] }
    const result = buildTaskRuntime(data, config, ctrlRt, resRt)
    expect(typeof result).not.toBe('string')
    if (typeof result !== 'string') {
      expect(result.tasks[0].pipeline_override).toHaveLength(2)
      expect(result.tasks[0].pipeline_override[1]).toEqual({ overrideKey: 'overrideVal' })
    }
  })

  it('handles empty task list', () => {
    const data = makeInterface()
    const config = makeConfig()
    const ctrlRt = {
      name: 'Ctrl',
      type: 'adb' as const,
      args: ['', '', 0, 0, '{}'] as [string, string, string | number, string | number, string]
    }
    const resRt = { name: 'Res', paths: [] }
    const result = buildTaskRuntime(data, config, ctrlRt, resRt)
    expect(typeof result).not.toBe('string')
    if (typeof result !== 'string') {
      expect(result.tasks).toHaveLength(0)
    }
  })
})
