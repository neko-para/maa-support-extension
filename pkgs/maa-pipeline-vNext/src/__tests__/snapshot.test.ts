import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { parsePipelineFile } from '../pipeline/fw'
import type { TaskInfoInFile } from '../pipeline/types'
import { BundleView, FileView, Snapshot, createBundleView, createSnapshot } from '../snapshot'
import type { AbsolutePath, ImageRelativePath, TaskName } from '../types'

function loadPipeline(name: string) {
  const path = join(__dirname, 'fixtures', name)
  const json = readFileSync(path, 'utf8')
  return parsePipelineFile(json, { maa: false })
}

function makeFileView(fixtureName: string) {
  const filePath = ('/fake/' + fixtureName) as AbsolutePath
  const { tasks: rawTasks, fileDecls: rawFileDecls } = loadPipeline(fixtureName)
  const tasks = new Map<TaskName, TaskInfoInFile>()
  for (const [name, info] of rawTasks) {
    tasks.set(name, {
      parts: info.parts,
      decls: info.decls.map(d => ({ ...d, file: filePath })),
      refs: info.refs.map(r => ({ ...r, file: filePath }))
    })
  }
  return { path: filePath, tasks, fileDecls: rawFileDecls.map(d => ({ ...d, file: filePath })) }
}

describe('FileView', () => {
  const fv = makeFileView('pipeline-v1.json')

  it('stores task map from parsePipelineFile', () => {
    expect(fv.tasks.size).toBe(3)
    expect(fv.tasks.has('T001Start' as TaskName)).toBe(true)
  })

  it('allDecls returns all decls from all tasks', () => {
    const decls = FileView.allDecls(fv)
    expect(decls.filter(d => d.type === 'task.decl')).toHaveLength(3)
    expect(decls.filter(d => d.type === 'task.doc')).toHaveLength(1)
  })

  it('allRefs returns all refs from all tasks', () => {
    const refs = FileView.allRefs(fv)
    expect(refs.filter(r => r.type === 'task.next')).toHaveLength(2)
    expect(refs.filter(r => r.type === 'task.template')).toHaveLength(1)
  })

  it('is serializable to JSON', () => {
    const json = JSON.stringify(fv)
    const parsed = JSON.parse(json)
    expect(parsed.path).toBe('/fake/pipeline-v1.json')
    expect(parsed.tasks).toBeDefined()
  })
})

describe('BundleView', () => {
  it('aggregates multiple files', () => {
    const bv = createBundleView({
      root: '/fake' as AbsolutePath,
      files: new Map([
        ['a.json', makeFileView('pipeline-v1.json')],
        ['b.json', makeFileView('pipeline-v2.json')]
      ]),
      images: new Set(['ui/btn.png', 'ui/icon.png'] as ImageRelativePath[])
    })
    expect(bv.files.size).toBe(2)
    expect(BundleView.listTasks(bv)).toHaveLength(5)
    expect(BundleView.getImageList(bv)).toHaveLength(2)
  })

  it('findTask locates task in files', () => {
    const bv = createBundleView({
      root: '/fake' as AbsolutePath,
      files: new Map([['a.json', makeFileView('pipeline-v1.json')]]),
      images: new Set()
    })
    const task = BundleView.findTask(bv, 'T001Start' as TaskName)
    expect(task).toBeDefined()
    expect(task!.decls[0].type).toBe('task.decl')
  })

  it('findTask returns null for missing', () => {
    const bv = createBundleView({
      root: '/fake' as AbsolutePath,
      files: new Map([['a.json', makeFileView('pipeline-v1.json')]]),
      images: new Set()
    })
    expect(BundleView.findTask(bv, 'Nonexistent' as TaskName)).toBeNull()
  })

  it('allDecls/allRefs merge across files', () => {
    const bv = createBundleView({
      root: '/fake' as AbsolutePath,
      files: new Map([
        ['a.json', makeFileView('pipeline-v1.json')],
        ['b.json', makeFileView('pipeline-v2.json')]
      ]),
      images: new Set()
    })
    expect(BundleView.allDecls(bv).filter(d => d.type === 'task.decl')).toHaveLength(5)
    expect(BundleView.allRefs(bv).filter(r => r.type === 'task.next')).toHaveLength(3)
  })

  it('getAnchorList', () => {
    const bv = createBundleView({
      root: '/fake' as AbsolutePath,
      files: new Map([['a.json', makeFileView('pipeline-anchor.json')]]),
      images: new Set()
    })
    expect(BundleView.getAnchorList(bv).length).toBeGreaterThanOrEqual(3)
  })

  it('getImageFolders groups by directory', () => {
    const bv = createBundleView({
      root: '/fake' as AbsolutePath,
      files: new Map(),
      images: new Set(['a/b/c.png', 'a/d.png'] as ImageRelativePath[])
    })
    const folders = BundleView.getImageFolders(bv)
    expect(folders.has('a/b' as ImageRelativePath)).toBe(true)
    expect(folders.has('a' as ImageRelativePath)).toBe(true)
  })
})

describe('ResourceSnapshot', () => {
  function makeSnapshot() {
    const b1 = createBundleView({
      root: '/fake/base' as AbsolutePath,
      files: new Map([['base.json', makeFileView('pipeline-v1.json')]]),
      images: new Set(['base/img.png'] as ImageRelativePath[])
    })
    const b2 = createBundleView({
      root: '/fake/overlay' as AbsolutePath,
      files: new Map([['overlay.json', makeFileView('pipeline-v2.json')]]),
      images: new Set(['overlay/img.png'] as ImageRelativePath[])
    })
    return createSnapshot({ bundles: [b1, b2] })
  }

  it('locateBundle finds file by path', () => {
    const snap = makeSnapshot()
    const found = Snapshot.locateBundle(snap, '/fake/pipeline-v1.json')
    expect(found).not.toBeNull()
    expect(found!.bundle.root).toBe('/fake/base')
  })

  it('locateBundle returns null for unknown', () => {
    expect(Snapshot.locateBundle(makeSnapshot(), '/unknown')).toBeNull()
  })

  it('findTask walks bundles last-to-first', () => {
    const task = Snapshot.findTask(makeSnapshot(), 'T001Start' as TaskName)
    expect(task).toBeDefined()
  })

  it('findTask returns null for missing', () => {
    expect(Snapshot.findTask(makeSnapshot(), 'NotFound' as TaskName)).toBeNull()
  })

  it('listTasks deduplicates across bundles', () => {
    expect(Snapshot.listTasks(makeSnapshot())).toHaveLength(5)
  })

  it('allDecls/allRefs include bundleIndex', () => {
    const snap = makeSnapshot()
    const decls = Snapshot.allDecls(snap)
    expect(decls.some(d => d.bundleIndex === 0)).toBe(true)
    expect(decls.some(d => d.bundleIndex === 1)).toBe(true)
    expect(Snapshot.allRefs(snap).length).toBeGreaterThan(0)
  })

  it('withBundle returns new immutable snapshot', () => {
    const snap = makeSnapshot()
    const newBundle = createBundleView({
      root: '/fake/base' as AbsolutePath,
      files: new Map(),
      images: new Set()
    })
    const next = Snapshot.withBundle(snap, 0, newBundle)
    expect(next).not.toBe(snap)
    expect(next.bundles[0]).toBe(newBundle)
    expect(snap.bundles[0]).not.toBe(newBundle)
  })

  it('listImages merges across bundles', () => {
    expect(Snapshot.listImages(makeSnapshot())).toHaveLength(2)
  })

  it('getAnchorList merges across bundles', () => {
    const bv = createBundleView({
      root: '/fake' as AbsolutePath,
      files: new Map([['a.json', makeFileView('pipeline-anchor.json')]]),
      images: new Set()
    })
    const snap = createSnapshot({ bundles: [bv] })
    expect(Snapshot.getAnchorList(snap).length).toBeGreaterThan(0)
  })

  it('getImageFolders merges across bundles', () => {
    const b1 = createBundleView({ root: '/a' as AbsolutePath, files: new Map(), images: new Set(['ui/btn.png'] as ImageRelativePath[]) })
    const b2 = createBundleView({ root: '/b' as AbsolutePath, files: new Map(), images: new Set(['ui/icon.png'] as ImageRelativePath[]) })
    const snap = createSnapshot({ bundles: [b1, b2] })
    expect(Snapshot.getImageFolders(snap).get('ui' as ImageRelativePath)?.length).toBe(2)
  })

  it('Snapshot is serializable to JSON (no methods)', () => {
    const snap = makeSnapshot()
    const json = JSON.stringify(snap)
    const parsed = JSON.parse(json)
    expect(parsed.bundles).toBeDefined()
    expect(parsed.activeController).toBe('')
    expect(typeof parsed.locateBundle).toBe('undefined')
  })
})
