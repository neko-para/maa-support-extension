import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { parsePipelineFile, parseTaskNode } from '../pipeline/fw'
import type { TaskName } from '../types'
import { parseTreeWithoutParent } from '../utils/json'

function loadFixture(name: string) {
  const path = join(__dirname, 'fixtures', name)
  const json = readFileSync(path, 'utf8')
  return parsePipelineFile(json, { maa: false }).tasks
}

describe('parsePipelineFile — v1 format', () => {
  const tasks = loadFixture('pipeline-v1.json')

  it('parses all 3 tasks', () => {
    expect(tasks.size).toBe(3)
  })

  it('creates task.decl for each task', () => {
    for (const t of tasks.values()) {
      const decl = t.decls.find(d => d.type === 'task.decl')
      expect(decl).toBeDefined()
    }
  })

  it('parses next with JumpBack attribute', () => {
    const start = tasks.get('T001Start' as TaskName)!
    const nexts = start.refs.filter(r => r.type === 'task.next')
    expect(nexts).toHaveLength(2)
    expect(nexts[0].target).toBe('T001SubA')
    expect(nexts[0].objMode).toBe(false)
    expect(nexts[0].attrs.attrs.JumpBack).toBe(true)
    expect(nexts[1].target).toBe('T001End')
    expect(nexts[1].attrs.attrs.JumpBack).toBeUndefined()
  })

  it('parses template reference', () => {
    const sub = tasks.get('T001SubA' as TaskName)!
    const tmpl = sub.refs.find(r => r.type === 'task.template')
    expect(tmpl).toBeDefined()
    expect(tmpl!.target).toBe('ui/button.png')
  })

  it('extracts recoType and actType from v1 strings', () => {
    const sub = tasks.get('T001SubA' as TaskName)!
    expect(sub.parts.recoType?.value).toBe('TemplateMatch')
    expect(sub.parts.actType?.value).toBe('Click')
  })

  it('categorizes properties correctly', () => {
    const sub = tasks.get('T001SubA' as TaskName)!
    expect(sub.parts.base.some(p => p[0] === 'post_wait_freezes')).toBe(true)
    expect(sub.parts.reco.some(p => p[0] === 'template')).toBe(true)
    expect(sub.parts.base.some(p => p[0] === 'desc')).toBe(true)
  })
})

describe('parsePipelineFile — v2 format', () => {
  const tasks = loadFixture('pipeline-v2.json')

  it('parses v2 recognition object', () => {
    const main = tasks.get('T002Main' as TaskName)!
    expect(main.parts.recoType?.value).toBe('TemplateMatch')
    const tmpl = main.refs.find(r => r.type === 'task.template')
    expect(tmpl!.target).toBe('ui/main.png')
  })

  it('parses v2 action object + target reference', () => {
    const main = tasks.get('T002Main' as TaskName)!
    expect(main.parts.actType?.value).toBe('Click')
    const tgt = main.refs.find(r => r.type === 'task.target')
    expect(tgt).toBeDefined()
    expect(tgt!.target).toBe('T002Target')
  })

  it('begin/end as fixed coordinates produce no target refs', () => {
    const target = tasks.get('T002Target' as TaskName)!
    const targets = target.refs.filter(r => r.type === 'task.target')
    expect(targets).toHaveLength(0)
  })
})

describe('parsePipelineFile — anchor', () => {
  const tasks = loadFixture('pipeline-anchor.json')

  it('parses string anchor declaration', () => {
    const set = tasks.get('T003SetAnchor' as TaskName)!
    const decl = set.decls.find(d => d.type === 'task.anchor' && d.anchor === 'T003AnchorA')
    expect(decl).toBeDefined()
    expect(decl?.type === 'task.anchor' && decl.belong).toBe('T003SetAnchor')
  })

  it('parses array anchor declaration', () => {
    const multi = tasks.get('T003MultiAnchor' as TaskName)!
    const anchors = multi.decls.filter(d => d.type === 'task.anchor')
    expect(anchors.map(a => a.anchor).sort()).toEqual(['T003AnchorB', 'T003AnchorC'])
  })

  it('parses object anchor with target mapping', () => {
    const obj = tasks.get('T003ObjAnchor' as TaskName)!
    const decls = obj.decls.filter(d => d.type === 'task.anchor')
    expect(decls.find(d => d.anchor === 'T003AnchorX' && d.task === 'T003Target')).toBeDefined()
    expect(decls.find(d => d.anchor === 'T003AnchorY' && d.task === '')).toBeDefined()
  })

  it('parses Anchor attribute on next target', () => {
    const entry = tasks.get('T003Entry' as TaskName)!
    const anchorNext = entry.refs.find(r => r.type === 'task.next' && r.attrs.attrs.Anchor)
    expect(anchorNext).toBeDefined()
    expect(anchorNext?.type === 'task.next' && anchorNext.target).toBe('T003AnchorA')
  })
})

describe('parsePipelineFile — composite recognition', () => {
  const tasks = loadFixture('pipeline-composite.json')

  it('parses And with inline recognition + sub_name', () => {
    const and = tasks.get('T004And' as TaskName)!
    const subs = and.decls.filter(d => d.type === 'task.sub_reco')
    expect(subs).toHaveLength(1)
    expect(subs[0].name).toBe('icon')
  })

  it('parses And with inline template + ROI references (prevRef)', () => {
    const and = tasks.get('T004And' as TaskName)!
    const tmpls = and.refs.filter(r => r.type === 'task.template')
    expect(tmpls).toHaveLength(1)
    expect(tmpls[0].target).toBe('ui/icon_a.png')
    const rois = and.refs.filter(r => r.type === 'task.roi')
    expect(rois).toHaveLength(1)
    expect(rois[0].target).toBe('icon')
    expect(rois[0].prevRef).toBe(true)
  })

  it('parses Or with node reference + inline', () => {
    const or = tasks.get('T004Or' as TaskName)!
    const recos = or.refs.filter(r => r.type === 'task.reco')
    expect(recos).toHaveLength(1)
    expect(recos[0].target).toBe('T004RefA')
  })

  it('parses HSV color (method=40)', () => {
    const color = tasks.get('T004Color' as TaskName)!
    const cols = color.refs.filter(r => r.type === 'task.color')
    expect(cols).toHaveLength(2)
    expect(cols[0].method).toBe('hsv')
    expect(cols[0].color).toEqual([0, 0, 200])
    expect(cols[1].color).toEqual([30, 30, 255])
  })
})

describe('parseTaskNode — edge cases', () => {
  it('handles empty object', () => {
    const json = '{}'
    const tree = parseTreeWithoutParent(json)!
    const result = parseTaskNode(tree, { taskKey: tree, taskName: 'Empty' as TaskName })
    expect(result.decls).toHaveLength(1)
    expect(result.decls[0].type).toBe('task.decl')
    expect(result.refs).toHaveLength(0)
  })

  it('preserves duplicate keys', () => {
    const json = '{"next": ["T1", "T2"], "next": ["T3"]}'
    const tree = parseTreeWithoutParent(json)!
    const result = parseTaskNode(tree, { taskKey: tree, taskName: 'Dup' as TaskName })
    const nexts = result.refs.filter(r => r.type === 'task.next')
    expect(nexts).toHaveLength(3)
  })

  it('recoType undefined when no recognition field', () => {
    const json = '{"action": "Click"}'
    const tree = parseTreeWithoutParent(json)!
    const result = parseTaskNode(tree, { taskKey: tree, taskName: 'NoReco' as TaskName })
    expect(result.parts.recoType).toBeUndefined()
  })

  it('next as single string', () => {
    const json = '{"next": "SingleTarget"}'
    const tree = parseTreeWithoutParent(json)!
    const result = parseTaskNode(tree, { taskKey: tree, taskName: 'Solo' as TaskName })
    expect(result.refs).toHaveLength(1)
    expect(result.refs[0].type).toBe('task.next')
    const ref = result.refs[0]
    expect(ref.type === 'task.next' && ref.target).toBe('SingleTarget')
  })

  it('desc field creates doc decl', () => {
    const json = '{"desc": "a description"}'
    const tree = parseTreeWithoutParent(json)!
    const result = parseTaskNode(tree, { taskKey: tree, taskName: 'DocExample' as TaskName })
    const doc = result.decls.find(d => d.type === 'task.doc')
    expect(doc).toBeDefined()
    expect(doc!.doc).toBe('a description')
  })

  it('$__mpe prefixed keys create mpe_config decl in task', () => {
    const json = '{"$__mpe_custom": 123}'
    const tree = parseTreeWithoutParent(json)!
    const result = parseTaskNode(tree, { taskKey: tree, taskName: 'Mpe' as TaskName })
    expect(result.decls.some(d => d.type === 'task.mpe_config')).toBe(true)
  })

  it('$__mpe prefixed keys create file-level mpe_config decls', () => {
    const json = '{"$__mpe_meta1": 1, "$__mpe_meta2": 2, "NormalTask": {"action": "Click"}}'
    const { tasks, fileDecls } = parsePipelineFile(json, { maa: false })
    expect(tasks.size).toBe(1)
    expect(fileDecls).toHaveLength(2)
    expect(fileDecls[0].type).toBe('task.mpe_config')
    expect(fileDecls[1].type).toBe('task.mpe_config')
  })
})

describe('parsePipelineFile — MAA mode', () => {
  it('parses MAA format pipeline file', () => {
    const json =
      '{"MaaTask1": {"algorithm": "MatchTemplate", "action": "Click", "template": "t.png", "baseTask": "Base"}, "MaaTask2": {"algorithm": "OcrDetect", "text": ["OK"]}}'
    const { tasks } = parsePipelineFile(json, { maa: true })
    expect(tasks.size).toBe(2)

    const t1 = tasks.get('MaaTask1' as TaskName)!
    expect(t1.parts.recoType?.value).toBe('MatchTemplate')
    expect(t1.parts.actType?.value).toBe('Click')
    const baseRef = t1.refs.find(r => r.type === 'task.maa.base_task')
    expect(baseRef).toBeDefined()
    expect(baseRef!.target).toBe('Base')

    const tmpl = t1.refs.find(r => r.type === 'task.template')
    expect(tmpl!.target).toBe('t.png')
  })
})

describe('parseTaskNode — focus', () => {
  it('parses focus with locale ($ prefix)', () => {
    const json = '{"focus": {"display": "$some.key"}}'
    const tree = parseTreeWithoutParent(json)!
    const result = parseTaskNode(tree, { taskKey: tree, taskName: 'FocusTask' as TaskName })
    const locale = result.refs.find(r => r.type === 'task.locale')
    expect(locale).toBeDefined()
    expect(locale!.target).toBe('some.key')
  })

  it('parses focus with can_locale (non-$ string)', () => {
    const json = '{"focus": {"display": "plain_text"}}'
    const tree = parseTreeWithoutParent(json)!
    const result = parseTaskNode(tree, { taskKey: tree, taskName: 'FocusTask2' as TaskName })
    const canLocale = result.refs.find(r => r.type === 'task.can_locale')
    expect(canLocale).toBeDefined()
    expect(canLocale!.target).toBe('plain_text')
  })
})

describe('parseTaskNode — freeze', () => {
  it('parses target ref inside freeze objects', () => {
    const json = '{"pre_wait_freezes": {"target": "SomeNode"}}'
    const tree = parseTreeWithoutParent(json)!
    const result = parseTaskNode(tree, { taskKey: tree, taskName: 'FreezeTask' as TaskName })
    const tgt = result.refs.find(r => r.type === 'task.target')
    expect(tgt).toBeDefined()
    expect(tgt!.target).toBe('SomeNode')
  })
})
