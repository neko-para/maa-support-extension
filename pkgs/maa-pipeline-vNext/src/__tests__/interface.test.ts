import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { mergeInterfaces, parseInterface } from '../interface'
import type { InterfaceDeclInFile, InterfaceParseResult, InterfaceRefInFile } from '../interface/types'
import type { AbsolutePath, RelativePath } from '../types'

function annotate(raw: ReturnType<typeof parseInterface>, file: AbsolutePath): InterfaceParseResult {
  expect(raw).not.toBeNull()
  return {
    data: raw!.data,
    decls: raw!.decls.map(d => ({ ...d, file }) as InterfaceDeclInFile),
    refs: raw!.refs.map(r => ({ ...r, file }) as InterfaceRefInFile)
  }
}

function parse(json: string): InterfaceParseResult {
  return annotate(parseInterface(json), '/fake/interface.json' as AbsolutePath)
}

function loadFixture(name: string): InterfaceParseResult {
  const path = join(__dirname, 'fixtures', name) as AbsolutePath
  const json = readFileSync(path, 'utf8')
  return annotate(parseInterface(json), path)
}

describe('parseInterface', () => {
  it('returns empty Records for empty JSON object', () => {
    const { data } = parse('{}')
    expect(data.controller).toEqual({})
    expect(data.task).toEqual({})
  })

  it('returns null for non-object AST', () => {
    expect(parseInterface('[]')).toBeNull()
    expect(parseInterface('"string"')).toBeNull()
    expect(parseInterface('42')).toBeNull()
  })

  it('supports JSONC comments and trailing commas', () => {
    const { data } = parse('{ // c\n "name": "T" /* b */, "version": "1", }')
    expect(data.name).toBe('T')
    expect(data.version).toBe('1')
  })

  it('converts arrays to Record by name', () => {
    const { data } = loadFixture('interface.json')
    expect(Object.keys(data.controller)).toEqual([
      'Win32Controller',
      'AdbController',
      'PlayCoverController',
      'GamepadController'
    ])
    expect(Object.keys(data.resource)).toEqual(['official', 'custom'])
    expect(Object.keys(data.task)).toEqual(['StartUp', 'Fight', 'Farm'])
    expect(Object.keys(data.preset)).toEqual(['default', 'farm_mode'])
  })

  it('converts nested arrays to Record (cases, inputs, preset tasks)', () => {
    const { data } = loadFixture('interface.json')
    expect(
      Object.keys((data.option.resolution as { cases?: Record<string, unknown> }).cases!)
    ).toEqual(['720p', '1080p'])
    expect(
      Object.keys((data.option.custom_input as { inputs?: Record<string, unknown> }).inputs!)
    ).toEqual(['threshold', 'count'])
    expect(Object.keys(data.preset.default.task!)).toEqual(['StartUp', 'Fight'])
  })
})

// ═══ Decls ═══

describe('parseInterface — decls', () => {
  const { decls } = loadFixture('interface.json')

  it('extracts controller decls with location', () => {
    const ct = decls.filter(d => d.type === 'interface.controller')
    expect(ct).toHaveLength(4)
    expect(ct.map(d => d.name)).toEqual([
      'Win32Controller',
      'AdbController',
      'PlayCoverController',
      'GamepadController'
    ])
    for (const d of ct) {
      expect(d.location).toBeDefined()
    }
  })

  it('extracts resource and task decls in order', () => {
    expect(decls.filter(d => d.type === 'interface.resource').map(d => d.name)).toEqual([
      'official',
      'custom'
    ])
    expect(decls.filter(d => d.type === 'interface.task').map(d => d.name)).toEqual([
      'StartUp',
      'Fight',
      'Farm'
    ])
  })

  it('extracts option decls with optionType', () => {
    const opts = decls.filter(d => d.type === 'interface.option')
    expect(opts.some(d => d.name === 'resolution' && d.optionType === 'select')).toBe(true)
    expect(opts.some(d => d.name === 'difficulty' && d.optionType === 'switch')).toBe(true)
    expect(opts.some(d => d.name === 'debug_mode' && d.optionType === 'checkbox')).toBe(true)
    expect(opts.some(d => d.name === 'custom_input' && d.optionType === 'input')).toBe(true)
  })

  it('extracts case decls with parent option', () => {
    const cases = decls.filter(d => d.type === 'interface.case')
    expect(cases).toHaveLength(7)
    expect(cases.find(d => d.name === '720p' && d.option === 'resolution')).toBeDefined()
  })

  it('extracts input decls with cast type', () => {
    const inputs = decls.filter(d => d.type === 'interface.input')
    expect(inputs).toHaveLength(2)
    expect(inputs.find(d => d.name === 'threshold')!.cast).toBe('string')
    expect(inputs.find(d => d.name === 'count')!.cast).toBe('int')
  })

  it('extracts preset, group, and language decls', () => {
    expect(decls.filter(d => d.type === 'interface.preset').map(d => d.name)).toEqual([
      'default',
      'farm_mode'
    ])
    expect(decls.filter(d => d.type === 'interface.group').map(d => d.name)).toEqual([
      'core_tasks',
      'extra_tasks'
    ])
    expect(decls.filter(d => d.type === 'interface.language')).toHaveLength(2)
  })
})

// ═══ Refs ═══

describe('parseInterface — refs', () => {
  const { refs } = loadFixture('interface.json')

  it('extracts import and language path refs', () => {
    expect(refs.filter(r => r.type === 'interface.import_path')).toHaveLength(1)
    expect(refs.filter(r => r.type === 'interface.language_path')).toHaveLength(2)
  })

  it('extracts resource_path refs from resource paths and attach_resource_path', () => {
    expect(refs.filter(r => r.type === 'interface.resource_path')).toHaveLength(4)
  })

  it('extracts controller/resource refs from tasks', () => {
    const cr = refs.filter(r => r.type === 'interface.controller')
    expect(cr.some(r => r.target === 'AdbController')).toBe(true)
    expect(cr.some(r => r.target === 'Win32Controller')).toBe(true)
    const rr = refs.filter(r => r.type === 'interface.resource')
    expect(rr.some(r => r.target === 'official')).toBe(true)
    expect(rr.some(r => r.target === 'custom')).toBe(true)
  })

  it('extracts task_entry refs with task context', () => {
    const te = refs.filter(r => r.type === 'interface.task_entry')
    expect(te).toHaveLength(3)
    expect(te.find(r => r.target === 'T001Start' && r.task === 'StartUp')).toBeDefined()
  })

  it('extracts option refs with trace origin', () => {
    const or = refs.filter(r => r.type === 'interface.option')
    expect(or.some(r => r.trace.from === 'global')).toBe(true)
    expect(or.some(r => r.trace.from === 'controller')).toBe(true)
    expect(or.some(r => r.trace.from === 'resource')).toBe(true)
    expect(or.some(r => r.trace.from === 'task')).toBe(true)
    expect(or.some(r => r.trace.from === 'preset')).toBe(true)
  })

  it('extracts case refs from default_case', () => {
    expect(refs.filter(r => r.type === 'interface.case').length).toBeGreaterThanOrEqual(3)
  })

  it('extracts input refs from pipeline_override templates', () => {
    const ir = refs.filter(r => r.type === 'interface.input')
    expect(ir).toHaveLength(2)
    expect(ir.some(r => r.target === 'threshold')).toBe(true)
    expect(ir.some(r => r.target === 'count')).toBe(true)
  })

  it('extracts group refs from tasks', () => {
    const gr = refs.filter(r => r.type === 'interface.group')
    expect(gr).toHaveLength(3)
  })

  it('preset option refs carry presetValue', () => {
    const po = refs.filter(r => r.type === 'interface.option' && r.trace.from === 'preset')
    expect(po).toHaveLength(3)
  })
})

// ═══ mergeInterfaces ═══

function makeBase(): InterfaceParseResult {
  return {
    data: {
      controller: { Adb: { type: 'Adb' as const } },
      resource: { res1: { path: 'path/res1' as RelativePath } },
      task: { TaskA: { entry: 'TA' }, TaskB: { entry: 'TB' } },
      option: { opt1: { type: 'select' as const, cases: { case1: {} } } },
      preset: { preset1: {} },
      group: {},
      import: ['import/file.json' as RelativePath]
    },
    decls: [
      {
        type: 'interface.task' as const,
        name: 'TaskA',
        location: {} as never,
        file: '/fake/base.json' as AbsolutePath
      }
    ],
    refs: [
      {
        type: 'interface.import_path' as const,
        target: 'import/file.json' as RelativePath,
        location: {} as never,
        file: '/fake/base.json' as AbsolutePath
      }
    ]
  }
}

function makeImport(): InterfaceParseResult {
  return {
    data: {
      controller: { IgnoredCtrl: { type: 'Adb' as const } },
      resource: { IgnoredRes: { path: 'ignored' as RelativePath } },
      task: { TaskC: { entry: 'TC' } },
      option: {
        opt1: { type: 'select' as const, cases: { override_case: {} } },
        opt2: { type: 'checkbox' as const, cases: { new_case: {} } }
      },
      preset: { preset2: {} },
      group: {}
    },
    decls: [
      {
        type: 'interface.task' as const,
        name: 'TaskC',
        location: {} as never,
        file: '/fake/import.json' as AbsolutePath
      }
    ],
    refs: [
      {
        type: 'interface.import_path' as const,
        target: 'extra_import.json' as RelativePath,
        location: {} as never,
        file: '/fake/import.json' as AbsolutePath
      }
    ]
  }
}

describe('mergeInterfaces', () => {
  it('returns base when no imports', () => {
    const base = makeBase()
    expect(mergeInterfaces(base)).toBe(base)
  })

  it('merges task, option, preset Records from imports', () => {
    const m = mergeInterfaces(makeBase(), makeImport())
    expect(Object.keys(m.data.task)).toEqual(['TaskA', 'TaskB', 'TaskC'])
    expect(Object.keys(m.data.option)).toEqual(['opt1', 'opt2'])
    expect(Object.keys(m.data.preset)).toEqual(['preset1', 'preset2'])
  })

  it('import option overrides base with same key', () => {
    const m = mergeInterfaces(makeBase(), makeImport())
    expect(Object.keys((m.data.option.opt1 as { cases?: Record<string, unknown> }).cases!)).toEqual(
      ['override_case']
    )
  })

  it('ignores controller, resource, import from imported files', () => {
    const m = mergeInterfaces(makeBase(), makeImport())
    expect(Object.keys(m.data.controller)).toEqual(['Adb'])
    expect(Object.keys(m.data.resource)).toEqual(['res1'])
    expect(m.data.import).toEqual(['import/file.json'])
  })

  it('appends decls and refs from imports', () => {
    const m = mergeInterfaces(makeBase(), makeImport())
    expect(m.decls).toHaveLength(2)
    expect(m.refs).toHaveLength(2)
  })

  it('does not mutate input objects', () => {
    const base = makeBase()
    const imp = makeImport()
    const baseKeys = Object.keys(base.data.task)
    mergeInterfaces(base, imp)
    expect(Object.keys(base.data.task)).toEqual(baseKeys)
  })
})

describe('integration', () => {
  it('parses and merges real fixtures', () => {
    const base = loadFixture('interface.json')
    const imp = loadFixture('interface-import.json')
    const m = mergeInterfaces(base, imp)

    expect(Object.keys(m.data.task)).toHaveLength(4)
    expect(m.data.option.imported_option).toBeDefined()
    expect(Object.keys(m.data.preset)).toHaveLength(3)
    // controller from import ignored
    expect(Object.keys(m.data.controller)).toHaveLength(4)
  })
})
