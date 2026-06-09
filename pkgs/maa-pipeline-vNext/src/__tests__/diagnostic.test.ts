import { describe, expect, it } from 'vitest'

import { checkInterface, checkPipeline, performDiagnostic } from '../diagnostic'
import { parseInterface } from '../interface/parser'
import { parsePipelineFile } from '../pipeline/fw'
import { createBundleView, createSnapshot } from '../snapshot'

describe('checkPipeline', () => {
  it('produces mpe-config warning', () => {
    const json = '{"$__mpe_meta": 1, "T": {"action": "Click"}}'
    const { tasks, fileDecls } = parsePipelineFile(json, { maa: false })
    const snap = createSnapshot({
      bundles: [
        createBundleView({
          root: '/fake',
          files: new Map([['f.json', { path: '/fake/f.json', tasks, fileDecls }]]),
          images: new Set()
        })
      ]
    })
    const diags = checkPipeline(snap)
    expect(diags.some(d => d.type === 'mpe-config')).toBe(true)
  })

  it('detects unknown-task', () => {
    const json = '{"T1": {"next": ["T2", "T3"]}}'
    const { tasks, fileDecls } = parsePipelineFile(json, { maa: false })
    const snap = createSnapshot({
      bundles: [
        createBundleView({
          root: '/fake',
          files: new Map([['f.json', { path: '/fake/f.json', tasks, fileDecls }]]),
          images: new Set()
        })
      ]
    })
    const diags = checkPipeline(snap)
    const unknownTasks = diags.filter(d => d.type === 'unknown-task')
    expect(unknownTasks).toHaveLength(2)
    expect(unknownTasks[0].task).toBe('T2')
    expect(unknownTasks[1].task).toBe('T3')
  })

  it('does not flag self-references', () => {
    const json = '{"T1": {"action": "Click"}}'
    const { tasks, fileDecls } = parsePipelineFile(json, { maa: false })
    const snap = createSnapshot({
      bundles: [
        createBundleView({
          root: '/fake',
          files: new Map([['f.json', { path: '/fake/f.json', tasks, fileDecls }]]),
          images: new Set()
        })
      ]
    })
    const diags = checkPipeline(snap)
    expect(diags.filter(d => d.type === 'unknown-task')).toHaveLength(0)
  })

  it('detects unknown-image', () => {
    const json = '{"T1": {"recognition": "TemplateMatch", "template": "missing.png"}}'
    const { tasks, fileDecls } = parsePipelineFile(json, { maa: false })
    const snap = createSnapshot({
      bundles: [
        createBundleView({
          root: '/fake',
          files: new Map([['f.json', { path: '/fake/f.json', tasks, fileDecls }]]),
          images: new Set()
        })
      ]
    })
    const diags = checkPipeline(snap)
    expect(diags.some(d => d.type === 'unknown-image')).toBe(true)
  })

  it('accepts valid template', () => {
    const json = '{"T1": {"recognition": "TemplateMatch", "template": "img/icon.png"}}'
    const { tasks, fileDecls } = parsePipelineFile(json, { maa: false })
    const snap = createSnapshot({
      bundles: [
        createBundleView({
          root: '/fake',
          files: new Map([['f.json', { path: '/fake/f.json', tasks, fileDecls }]]),
          images: new Set(['img/icon.png']) as Set<never>
        })
      ]
    })
    const diags = checkPipeline(snap)
    expect(diags.filter(d => d.type === 'unknown-image')).toHaveLength(0)
  })

  it('detects image-path backslash', () => {
    const json = '{"T1": {"recognition": "TemplateMatch", "template": "img\\\\icon.png"}}'
    const { tasks, fileDecls } = parsePipelineFile(json, { maa: false })
    const snap = createSnapshot({
      bundles: [
        createBundleView({
          root: '/fake',
          files: new Map([['f.json', { path: '/fake/f.json', tasks, fileDecls }]]),
          images: new Set()
        })
      ]
    })
    const diags = checkPipeline(snap)
    expect(diags.some(d => d.type === 'image-path-back-slash')).toBe(true)
  })

  it('detects unknown-anchor', () => {
    const json = '{"T1": {"next": ["[Anchor]MissingAnchor"]}}'
    const { tasks, fileDecls } = parsePipelineFile(json, { maa: false })
    const snap = createSnapshot({
      bundles: [
        createBundleView({
          root: '/fake',
          files: new Map([['f.json', { path: '/fake/f.json', tasks, fileDecls }]]),
          images: new Set()
        })
      ]
    })
    const diags = checkPipeline(snap)
    expect(diags.some(d => d.type === 'unknown-anchor')).toBe(true)
  })

  it('detects unknown-attr', () => {
    const json = '{"T1": {"next": ["[Unknown]T2"]}}'
    const { tasks, fileDecls } = parsePipelineFile(json, { maa: false })
    const snap = createSnapshot({
      bundles: [
        createBundleView({
          root: '/fake',
          files: new Map([['f.json', { path: '/fake/f.json', tasks, fileDecls }]]),
          images: new Set()
        })
      ]
    })
    const diags = checkPipeline(snap)
    expect(diags.some(d => d.type === 'unknown-attr')).toBe(true)
  })
})

describe('checkInterface', () => {
  it('detects duplicate controllers', () => {
    const iface = parseInterface('{"controller": [{"name": "C1"}, {"name": "C1"}]}')!
    const snap = createSnapshot({ bundles: [], interface: iface })
    const diags = checkInterface(snap)
    expect(diags.some(d => d.type === 'int-conflict-controller')).toBe(true)
  })

  it('detects unknown controller ref', () => {
    const iface = parseInterface(
      '{"task": [{"name": "T1", "entry": "Start", "controller": ["UnknownCtrl"]}]}'
    )!
    const snap = createSnapshot({ bundles: [], interface: iface })
    const diags = checkInterface(snap)
    expect(diags.some(d => d.type === 'int-unknown-controller')).toBe(true)
  })

  it('detects switch missing', () => {
    const iface = parseInterface('{"option": {"sw": {"type": "switch"}}}')!
    const snap = createSnapshot({ bundles: [], interface: iface })
    const diags = checkInterface(snap)
    expect(diags.some(d => d.type === 'int-switch-missing')).toBe(true)
  })
})

describe('performDiagnostic', () => {
  it('filters by ignoreTypes', () => {
    const json = '{"$__mpe_meta": 1, "T1": {"action": "Click"}}'
    const { tasks, fileDecls } = parsePipelineFile(json, { maa: false })
    const snap = createSnapshot({
      bundles: [
        createBundleView({
          root: '/fake',
          files: new Map([['f.json', { path: '/fake/f.json', tasks, fileDecls }]]),
          images: new Set()
        })
      ]
    })
    const all = performDiagnostic(snap)
    expect(all.some(d => d.type === 'mpe-config')).toBe(true)
    const filtered = performDiagnostic(snap, { ignoreTypes: ['mpe-config'] })
    expect(filtered.some(d => d.type === 'mpe-config')).toBe(false)
  })

  it('upgrades level via errorTypes', () => {
    const json = '{"$__mpe_meta": 1, "T1": {"action": "Click"}}'
    const { tasks, fileDecls } = parsePipelineFile(json, { maa: false })
    const snap = createSnapshot({
      bundles: [
        createBundleView({
          root: '/fake',
          files: new Map([['f.json', { path: '/fake/f.json', tasks, fileDecls }]]),
          images: new Set()
        })
      ]
    })
    const upgraded = performDiagnostic(snap, { errorTypes: ['mpe-config'] })
    const mpe = upgraded.find(d => d.type === 'mpe-config')!
    expect(mpe.level).toBe('error')
  })
})
