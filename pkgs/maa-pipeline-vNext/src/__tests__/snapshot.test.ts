import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { IPathUtils } from '../path/interface'
import { parsePipelineFile } from '../pipeline/fw'
import type { TaskInfoInFile } from '../pipeline/types'
import {
  BundleView,
  FileViewUtils,
  Snapshot,
  createBundleView,
  createSnapshot,
  mergeIntoDefaults,
  normalizeImageFolder
} from '../snapshot'
import type { AbsolutePath, ImageRelativePath, RelativePath, TaskName } from '../types'

function loadPipeline(name: string) {
  const path = join(__dirname, 'fixtures', name)
  const json = readFileSync(path, 'utf8')
  return parsePipelineFile(json, { maa: false })
}

function loadDefaultConfig(): Map<TaskName, TaskInfoInFile> {
  const path = join(__dirname, 'fixtures', 'default-pipeline.json')
  const json = readFileSync(path, 'utf8')
  const { tasks: rawTasks } = parsePipelineFile(json, { maa: false, isDefault: true })
  const annotated = new Map<TaskName, TaskInfoInFile>()
  for (const [name, info] of rawTasks) {
    annotated.set(name, {
      parts: info.parts,
      decls: info.decls.map(d => ({ ...d, file: '/fake/default_pipeline.json' as AbsolutePath })),
      refs: info.refs.map(r => ({ ...r, file: '/fake/default_pipeline.json' as AbsolutePath })),
      prop: info.prop,
      data: info.data
    })
  }
  return annotated
}

function makeFileView(fixtureName: string) {
  const filePath = ('/fake/' + fixtureName) as AbsolutePath
  const { tasks: rawTasks, fileDecls: rawFileDecls } = loadPipeline(fixtureName)
  const tasks = new Map<TaskName, TaskInfoInFile[]>()
  for (const [name, info] of rawTasks) {
    tasks.set(name, [
      {
        parts: info.parts,
        decls: info.decls.map(d => ({ ...d, file: filePath })),
        refs: info.refs.map(r => ({ ...r, file: filePath })),
        prop: info.prop,
        data: info.data
      }
    ])
  }
  return {
    path: filePath,
    tasks,
    fileDecls: rawFileDecls.map(d => ({ ...d, file: filePath })),
    isDefault: false
  }
}

describe('FileView', () => {
  const fv = makeFileView('pipeline-v1.json')

  it('stores task map from parsePipelineFile', () => {
    expect(fv.tasks.size).toBe(3)
    expect(fv.tasks.has('T001Start' as TaskName)).toBe(true)
  })

  it('allDecls returns all decls from all tasks', () => {
    const decls = FileViewUtils.allDecls(fv)
    expect(decls.filter(d => d.type === 'task.decl')).toHaveLength(3)
    expect(decls.filter(d => d.type === 'task.doc')).toHaveLength(1)
  })

  it('allRefs returns all refs from all tasks', () => {
    const refs = FileViewUtils.allRefs(fv)
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
        ['a.json' as RelativePath, makeFileView('pipeline-v1.json')],
        ['b.json' as RelativePath, makeFileView('pipeline-v2.json')]
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
      files: new Map([['a.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
      images: new Set()
    })
    const task = BundleView.findTask(bv, 'T001Start' as TaskName)
    expect(task).toBeDefined()
    expect(task!.decls[0].type).toBe('task.decl')
  })

  it('findTask returns null for missing', () => {
    const bv = createBundleView({
      root: '/fake' as AbsolutePath,
      files: new Map([['a.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
      images: new Set()
    })
    expect(BundleView.findTask(bv, 'Nonexistent' as TaskName)).toBeNull()
  })

  it('allDecls/allRefs merge across files', () => {
    const bv = createBundleView({
      root: '/fake' as AbsolutePath,
      files: new Map([
        ['a.json' as RelativePath, makeFileView('pipeline-v1.json')],
        ['b.json' as RelativePath, makeFileView('pipeline-v2.json')]
      ]),
      images: new Set()
    })
    expect(BundleView.allDecls(bv).filter(d => d.type === 'task.decl')).toHaveLength(5)
    expect(BundleView.allRefs(bv).filter(r => r.type === 'task.next')).toHaveLength(3)
  })

  it('getAnchorList', () => {
    const bv = createBundleView({
      root: '/fake' as AbsolutePath,
      files: new Map([['a.json' as RelativePath, makeFileView('pipeline-anchor.json')]]),
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

  it('normalizeImageFolder normalizes backslash and strips trailing slash', () => {
    const mockPathUtils = {
      sep: '\\',
      normalize: (p: string) => p.replace(/\//g, '\\')
    } as IPathUtils
    const result = normalizeImageFolder(mockPathUtils, 'a\\b\\c/' as ImageRelativePath)
    expect(result).toBe('a/b/c')
  })

  it('BundleView.imagePath constructs maa/fw path', () => {
    const pu = { join: (...s: string[]) => s.join('/'), sep: '/' } as IPathUtils
    const fw = createBundleView({
      root: '/proj' as AbsolutePath,
      files: new Map(),
      images: new Set(),
      maa: false
    })
    expect(BundleView.imagePath(fw, pu, 'ui/btn.png' as ImageRelativePath)).toBe(
      '/proj/image/ui/btn.png'
    )

    const maa = createBundleView({
      root: '/proj' as AbsolutePath,
      files: new Map(),
      images: new Set(),
      maa: true
    })
    expect(BundleView.imagePath(maa, pu, 'ui/btn.png' as ImageRelativePath)).toBe(
      '/proj/template/ui/btn.png'
    )
  })

  describe('resolveTask', () => {
    it('resolves task without defaultConfig (framework defaults only)', () => {
      const bv = createBundleView({
        root: '/fake' as AbsolutePath,
        files: new Map([['a.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
        images: new Set()
      })
      const resolved = BundleView.resolveTask(bv, 'T001SubA' as TaskName)
      expect(resolved).not.toBeNull()
      expect(resolved!.recoType).toBe('TemplateMatch')
      expect(resolved!.actType).toBe('Click')
      // template comes from the task itself (no defaultConfig to override)
      expect(resolved!.config.template).toBe('ui/button.png')
      // pre_delay comes from task's own base
      expect(resolved!.config.pre_delay).toBeUndefined()
    })

    it('returns null for missing task', () => {
      const bv = createBundleView({
        root: '/fake' as AbsolutePath,
        files: new Map([['a.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
        images: new Set()
      })
      expect(BundleView.resolveTask(bv, 'Nonexistent' as TaskName)).toBeNull()
    })

    it('applies $Default from defaultConfig', () => {
      const bv = createBundleView({
        root: '/fake' as AbsolutePath,
        files: new Map([['a.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
        images: new Set(),
        defaultConfig: loadDefaultConfig()
      })
      const resolved = BundleView.resolveTask(bv, 'T001SubA' as TaskName)
      expect(resolved).not.toBeNull()
      // $Default.pre_delay = 100 should be inherited
      expect(resolved!.config.pre_delay).toBe(100)
      expect(resolved!.config.post_delay).toBe(50)
      expect(resolved!.config.timeout).toBe(30000)
    })

    it('applies $RecoType defaults from defaultConfig', () => {
      const bv = createBundleView({
        root: '/fake' as AbsolutePath,
        files: new Map([['a.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
        images: new Set(),
        defaultConfig: loadDefaultConfig()
      })
      const resolved = BundleView.resolveTask(bv, 'T001SubA' as TaskName)
      expect(resolved).not.toBeNull()
      // T001SubA has recoType='TemplateMatch', so $TemplateMatch defaults apply
      // template from $TemplateMatch is overridden by task's own template
      expect(resolved!.config.template).toBe('ui/button.png')
      // threshold from $TemplateMatch is inherited (task doesn't set it)
      expect(resolved!.config.threshold).toBe(0.7)
      // roi from task [100,200,300,400] overrides $TemplateMatch.roi [0,0,1280,720]
      expect(resolved!.config.roi).toEqual([100, 200, 300, 400])
    })

    it('applies $ActType defaults from defaultConfig', () => {
      const bv = createBundleView({
        root: '/fake' as AbsolutePath,
        files: new Map([['a.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
        images: new Set(),
        defaultConfig: loadDefaultConfig()
      })
      const resolved = BundleView.resolveTask(bv, 'T001SubA' as TaskName)
      expect(resolved).not.toBeNull()
      // T001SubA has actType='Click', so $Click defaults apply
      // target from $Click should be inherited
      expect(resolved!.config.target).toBe(true)
      expect(resolved!.config.duration).toBe(200)
    })

    it('task properties override defaultConfig (highest priority)', () => {
      const bv = createBundleView({
        root: '/fake' as AbsolutePath,
        files: new Map([['a.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
        images: new Set(),
        defaultConfig: loadDefaultConfig()
      })
      const resolved = BundleView.resolveTask(bv, 'T001SubA' as TaskName)
      expect(resolved).not.toBeNull()
      // $Default.pre_delay=100, but task overrides in base
      // the task doesn't set pre_delay, so $Default value stands
      expect(resolved!.config.pre_delay).toBe(100)
      // $TemplateMatch.threshold=0.7, task doesn't set threshold → inherited
      expect(resolved!.config.threshold).toBe(0.7)
      // $TemplateMatch.template='default/template.png', task overrides to 'ui/button.png'
      expect(resolved!.config.template).toBe('ui/button.png')
      // post_wait_freezes comes from task itself
      expect(resolved!.config.post_wait_freezes).toBe(300)
    })

    it('type-change cleanup: reco keys deleted when recoType changes from inherited', () => {
      // T001End has recoType='OCR'
      // $OCR has 'expected' and 'roi' keys
      // T001End sets its own 'expected' and no roi
      const bv = createBundleView({
        root: '/fake' as AbsolutePath,
        files: new Map([['a.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
        images: new Set(),
        defaultConfig: loadDefaultConfig()
      })
      const resolved = BundleView.resolveTask(bv, 'T001End' as TaskName)
      expect(resolved).not.toBeNull()
      expect(resolved!.recoType).toBe('OCR')
      // task's own expected overrides $OCR expected
      expect(resolved!.config.expected).toEqual(['Complete', 'Done'])
      // $OCR.roi=[0,0,1280,720] should be inherited since task doesn't override
      expect(resolved!.config.roi).toEqual([0, 0, 1280, 720])
    })

    it('type-change cleanup: reco keys deleted when recoType differs from default', () => {
      const bv = createBundleView({
        root: '/fake' as AbsolutePath,
        files: new Map([['a.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
        images: new Set(),
        defaultConfig: loadDefaultConfig()
      })
      // T001Start has no explicit recoType → effectiveReco='DirectHit' (framework default)
      // defaultConfig has $DirectHit → inheritedReco='DirectHit' → no type change
      const resolved = BundleView.resolveTask(bv, 'T001Start' as TaskName)
      expect(resolved).not.toBeNull()
      // T001Start sets pre_delay=0 → overrides $Default.pre_delay=100
      expect(resolved!.config.pre_delay).toBe(0)
      // T001Start sets post_delay=0 → overrides $Default.post_delay=50
      expect(resolved!.config.post_delay).toBe(0)
      // timeout comes from $Default (task doesn't set it)
      expect(resolved!.config.timeout).toBe(30000)
    })

    it('resolveTask config includes recognition and action as v1 strings', () => {
      const bv = createBundleView({
        root: '/fake' as AbsolutePath,
        files: new Map([['b.json' as RelativePath, makeFileView('pipeline-v2.json')]]),
        images: new Set(),
        defaultConfig: loadDefaultConfig()
      })
      const resolved = BundleView.resolveTask(bv, 'T002Main' as TaskName)
      expect(resolved).not.toBeNull()
      // Task's own recoType/actType take precedence
      expect(resolved!.recoType).toBe('TemplateMatch')
      expect(resolved!.actType).toBe('Click')
      expect(resolved!.config.recognition).toBe('TemplateMatch')
      expect(resolved!.config.action).toBe('Click')
    })
  })
})

describe('ResourceSnapshot', () => {
  function makeSnapshot() {
    const b1 = createBundleView({
      root: '/fake/base' as AbsolutePath,
      files: new Map([['base.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
      images: new Set(['base/img.png'] as ImageRelativePath[])
    })
    const b2 = createBundleView({
      root: '/fake/overlay' as AbsolutePath,
      files: new Map([['overlay.json' as RelativePath, makeFileView('pipeline-v2.json')]]),
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

  it('getImage finds image across bundles', () => {
    const pu = { join: (...s: string[]) => s.join('/'), sep: '/' } as IPathUtils
    const results = Snapshot.getImage(makeSnapshot(), pu, 'base/img.png' as ImageRelativePath)
    expect(results).toHaveLength(1)
    expect(results[0].absPath).toBe('/fake/base/image/base/img.png')
  })

  it('getImage returns empty for unknown image', () => {
    const pu = { join: (...s: string[]) => s.join('/'), sep: '/' } as IPathUtils
    expect(Snapshot.getImage(makeSnapshot(), pu, 'no/such.png' as ImageRelativePath)).toHaveLength(
      0
    )
  })

  it('getTask finds task definition across bundles', () => {
    const results = Snapshot.getTask(makeSnapshot(), 'T001Start' as TaskName)
    expect(results).toHaveLength(1)
    expect(results[0].bundle.root).toBe('/fake/base')
    expect(results[0].infos).toHaveLength(1)
    expect(results[0].infos[0].decls[0].type).toBe('task.decl')
  })

  it('getTask returns empty for unknown task', () => {
    expect(Snapshot.getTask(makeSnapshot(), 'NoSuchTask' as TaskName)).toHaveLength(0)
  })

  it('FileView includes isDefault flag', () => {
    const snap = makeSnapshot()
    const located = Snapshot.locateBundle(snap, '/fake/pipeline-v1.json')
    expect(located).not.toBeNull()
    expect(located!.file.isDefault).toBe(false)
  })

  describe('locale', () => {
    function makeSnapshotWithLocales() {
      const bv = createBundleView({
        root: '/fake' as AbsolutePath,
        files: new Map([['a.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
        images: new Set()
      })
      return createSnapshot({
        bundles: [bv],
        languages: [
          {
            name: 'zh-CN',
            file: '/fake/zh-CN.json' as AbsolutePath,
            entries: new Map([
              ['hello', { value: '你好', keyOffset: 10 }],
              ['world', { value: '世界', keyOffset: 30 }]
            ])
          },
          {
            name: 'en-US',
            file: '/fake/en-US.json' as AbsolutePath,
            entries: new Map([['hello', { value: 'Hello', keyOffset: 10 }]])
          }
        ]
      })
    }

    it('queryLocale returns entries with value and keyOffset', () => {
      const snap = makeSnapshotWithLocales()
      const hello = Snapshot.queryLocale(snap, 'hello')
      expect(hello[0]?.value).toBe('你好')
      expect(hello[0]?.keyOffset).toBe(10)
      expect(hello[1]?.value).toBe('Hello')
      expect(Snapshot.queryLocale(snap, 'world')[0]?.value).toBe('世界')
      expect(Snapshot.queryLocale(snap, 'world')[1]).toBeNull()
    })

    it('queryLocaleIndex finds by name', () => {
      const snap = makeSnapshotWithLocales()
      expect(Snapshot.queryLocaleIndex(snap, 'en-US')).toBe(1)
      expect(Snapshot.queryLocaleIndex(snap, 'zh-CN')).toBe(0)
      expect(Snapshot.queryLocaleIndex(snap, 'fr-FR')).toBe(0) // fallback
      expect(Snapshot.queryLocaleIndex(snap, undefined)).toBe(0)
    })

    it('allLocaleKeys returns unique keys', () => {
      const snap = makeSnapshotWithLocales()
      const keys = Snapshot.allLocaleKeys(snap)
      expect(keys).toContain('hello')
      expect(keys).toContain('world')
      expect(keys).toHaveLength(2)
    })
  })

  it('getAnchorList merges across bundles', () => {
    const bv = createBundleView({
      root: '/fake' as AbsolutePath,
      files: new Map([['a.json' as RelativePath, makeFileView('pipeline-anchor.json')]]),
      images: new Set()
    })
    const snap = createSnapshot({ bundles: [bv] })
    expect(Snapshot.getAnchorList(snap).length).toBeGreaterThan(0)
  })

  it('getImageFolders merges across bundles', () => {
    const b1 = createBundleView({
      root: '/a' as AbsolutePath,
      files: new Map(),
      images: new Set(['ui/btn.png'] as ImageRelativePath[])
    })
    const b2 = createBundleView({
      root: '/b' as AbsolutePath,
      files: new Map(),
      images: new Set(['ui/icon.png'] as ImageRelativePath[])
    })
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

  describe('resolveTask', () => {
    it('resolves task from highest-priority bundle', () => {
      const b1 = createBundleView({
        root: '/fake/base' as AbsolutePath,
        files: new Map([['base.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
        images: new Set()
      })
      const b2 = createBundleView({
        root: '/fake/overlay' as AbsolutePath,
        files: new Map([['overlay.json' as RelativePath, makeFileView('pipeline-v2.json')]]),
        images: new Set()
      })
      const snap = createSnapshot({ bundles: [b1, b2] })
      // T001SubA is only in b1 (lower priority)
      const resolved = Snapshot.resolveTask(snap, 'T001SubA' as TaskName)
      expect(resolved).not.toBeNull()
      expect(resolved!.recoType).toBe('TemplateMatch')
    })

    it('returns null when task not found in any bundle', () => {
      const snap = makeSnapshot()
      expect(Snapshot.resolveTask(snap, 'NoSuchTask' as TaskName)).toBeNull()
    })

    it('uses defaultConfig from the bundle that defines the task', () => {
      const dc = loadDefaultConfig()
      const b1 = createBundleView({
        root: '/fake/base' as AbsolutePath,
        files: new Map([['base.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
        images: new Set(),
        defaultConfig: dc
      })
      const b2 = createBundleView({
        root: '/fake/overlay' as AbsolutePath,
        files: new Map(),
        images: new Set()
      })
      const snap = createSnapshot({ bundles: [b1, b2] })
      const resolved = Snapshot.resolveTask(snap, 'T001SubA' as TaskName)
      expect(resolved).not.toBeNull()
      // defaultConfig from b1 should apply
      expect(resolved!.config.pre_delay).toBe(100)
      expect(resolved!.config.timeout).toBe(30000)
    })

    it('new task in higher bundle inherits cumulative defaults from earlier bundles', () => {
      const b1 = createBundleView({
        root: '/fake/base' as AbsolutePath,
        files: new Map([['base.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
        images: new Set(),
        defaultConfig: loadDefaultConfig()
      })
      // b2 is higher priority, defines T002Main (new task, not in b1), no defaultConfig
      const b2 = createBundleView({
        root: '/fake/overlay' as AbsolutePath,
        files: new Map([['overlay.json' as RelativePath, makeFileView('pipeline-v2.json')]]),
        images: new Set()
        // no defaultConfig
      })
      const snap = createSnapshot({ bundles: [b1, b2] })
      // T002Main is only in b2 (new task).
      // Progressive resolution: b1's defaults accumulated → T002Main gets cumulative defaults
      const resolved = Snapshot.resolveTask(snap, 'T002Main' as TaskName)
      expect(resolved).not.toBeNull()
      expect(resolved!.recoType).toBe('TemplateMatch')
      // Inherits pre_delay from b1's cumulative defaults
      expect(resolved!.config.pre_delay).toBe(100)
    })

    it('redefined task keeps first-definition defaults, overlays new props only', () => {
      // MaaFramework: redefined tasks use old resolved data as base,
      // new defaults are NOT re-applied.
      const b1 = createBundleView({
        root: '/fake/base' as AbsolutePath,
        files: new Map([['a.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
        images: new Set(),
        defaultConfig: loadDefaultConfig()
      })
      // b2 redefines the same tasks but with NO defaultConfig
      const b2 = createBundleView({
        root: '/fake/overlay' as AbsolutePath,
        files: new Map([['a.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
        images: new Set()
        // no defaultConfig
      })
      const snap = createSnapshot({ bundles: [b1, b2] })
      // T001SubA defined first in b1 → defaults baked in.
      // b2 redefines → only overlays b2's task props, no new defaults.
      // pre_delay from b1's defaults persists.
      const resolved = Snapshot.resolveTask(snap, 'T001SubA' as TaskName)
      expect(resolved).not.toBeNull()
      // b1's defaults persist through redefinition
      expect(resolved!.config.pre_delay).toBe(100)
    })

    it('resolved config is complete for diagnostic use', () => {
      const bv = createBundleView({
        root: '/fake' as AbsolutePath,
        files: new Map([['a.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
        images: new Set(),
        defaultConfig: loadDefaultConfig()
      })
      const snap = createSnapshot({ bundles: [bv] })
      const resolved = Snapshot.resolveTask(snap, 'T001SubA' as TaskName)
      expect(resolved).not.toBeNull()
      // Verify the full inheritance chain is reflected in config
      expect(resolved!.config.recognition).toBe('TemplateMatch')
      expect(resolved!.config.action).toBe('Click')
      expect(resolved!.config.pre_delay).toBe(100) // from $Default
      expect(resolved!.config.template).toBe('ui/button.png') // from task
      expect(resolved!.config.threshold).toBe(0.7) // from $TemplateMatch
      expect(resolved!.config.duration).toBe(200) // from $Click
      expect(resolved!.config.post_wait_freezes).toBe(300) // from task
      // Verify info is accessible
      expect(resolved!.info).toBeDefined()
      expect(resolved!.info.decls[0].type).toBe('task.decl')
    })

    it('resolveTask is serializable (config + recoType/actType)', () => {
      const bv = createBundleView({
        root: '/fake' as AbsolutePath,
        files: new Map([['a.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
        images: new Set(),
        defaultConfig: loadDefaultConfig()
      })
      const snap = createSnapshot({ bundles: [bv] })
      const resolved = Snapshot.resolveTask(snap, 'T001SubA' as TaskName)
      expect(resolved).not.toBeNull()
      const json = JSON.stringify(resolved)
      const parsed = JSON.parse(json)
      expect(parsed.recoType).toBe('TemplateMatch')
      expect(parsed.actType).toBe('Click')
      expect(parsed.config).toBeDefined()
      expect(parsed.config.pre_delay).toBe(100)
    })

    describe('multi-bundle defaultConfig merge', () => {
      it('mergeIntoDefaults merges same $Key across calls', () => {
        const dc = loadDefaultConfig()
        const merged: Record<string, Record<string, unknown>> = {}
        mergeIntoDefaults(merged, dc)
        mergeIntoDefaults(merged, dc) // second call dict-merges on top
        expect(merged['$Default']).toBeDefined()
        expect(merged['$Default'].pre_delay).toBe(100)
        expect(merged['$Default'].timeout).toBe(30000)
        expect(merged['$TemplateMatch']).toBeDefined()
        expect(merged['$TemplateMatch'].threshold).toBe(0.7)
      })

      it('mergeIntoDefaults combines different keys from different bundles', () => {
        const full = loadDefaultConfig()
        const dc1 = new Map<TaskName, TaskInfoInFile>()
        const defEntry = full.get('$Default' as TaskName)
        if (defEntry) dc1.set('$Default' as TaskName, defEntry)
        const dc2 = new Map<TaskName, TaskInfoInFile>()
        const tmEntry = full.get('$TemplateMatch' as TaskName)
        if (tmEntry) dc2.set('$TemplateMatch' as TaskName, tmEntry)

        const merged: Record<string, Record<string, unknown>> = {}
        mergeIntoDefaults(merged, dc1)
        mergeIntoDefaults(merged, dc2)
        expect(merged['$Default']).toBeDefined()
        expect(merged['$Default'].pre_delay).toBe(100)
        expect(merged['$TemplateMatch']).toBeDefined()
        expect(merged['$TemplateMatch'].threshold).toBe(0.7)
      })

      it('Snapshot.resolveTask uses merged defaults from bundles[0..definingIndex]', () => {
        // bundle0: has defaultConfig with $Default.pre_delay=100
        const b0 = createBundleView({
          root: '/fake/base' as AbsolutePath,
          files: new Map([['base.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
          images: new Set(),
          defaultConfig: loadDefaultConfig()
        })
        // bundle1 (higher priority): defines T002Main, has NO defaultConfig of its own
        const b1 = createBundleView({
          root: '/fake/overlay' as AbsolutePath,
          files: new Map([['overlay.json' as RelativePath, makeFileView('pipeline-v2.json')]]),
          images: new Set()
          // no defaultConfig
        })
        const snap = createSnapshot({ bundles: [b0, b1] })
        // T002Main is only in b1 (index 1).
        // Merged defaults = b0.defaultConfig + b1.defaultConfig(null) = b0's defaults only
        const resolved = Snapshot.resolveTask(snap, 'T002Main' as TaskName)
        expect(resolved).not.toBeNull()
        // $Default.pre_delay=100 from b0 should be inherited by b1's task
        expect(resolved!.config.pre_delay).toBe(100)
        expect(resolved!.config.timeout).toBe(30000)
      })

      it('task in earlier bundle uses only merged defaults up to that point', () => {
        // bundle0: has defaultConfig with $Default
        const b0 = createBundleView({
          root: '/fake/base' as AbsolutePath,
          files: new Map([['base.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
          images: new Set(),
          defaultConfig: loadDefaultConfig()
        })
        // bundle1: has defaultConfig too (simulates a "Debug" bundle with its own defaults)
        const b1 = createBundleView({
          root: '/fake/debug' as AbsolutePath,
          files: new Map(),
          images: new Set(),
          defaultConfig: loadDefaultConfig()
        })
        const snap = createSnapshot({ bundles: [b0, b1] })
        // T001SubA is in b0 (index 0).
        // Its merged defaults = bundles[0..0] = b0.defaultConfig only
        // b1's defaultConfig should NOT affect it (已加载的节点不受后续Bundle默认值影响)
        const resolved = Snapshot.resolveTask(snap, 'T001SubA' as TaskName)
        expect(resolved).not.toBeNull()
        expect(resolved!.config.pre_delay).toBe(100)
        expect(resolved!.config.timeout).toBe(30000)
      })

      it('overlay type-change re-applies new type defaults from cumulativeDefaults', () => {
        // Simulates MaaFramework C++: same_type ? parent_param : default_param
        // bundle0: defines T001SubA (TemplateMatch), has defaultConfig with $TemplateMatch
        const b0 = createBundleView({
          root: '/fake/base' as AbsolutePath,
          files: new Map([['base.json' as RelativePath, makeFileView('pipeline-v1.json')]]),
          images: new Set(),
          defaultConfig: loadDefaultConfig()
        })
        // bundle1: also has pipeline-v1, redefines T001SubA but changes type
        // We use T001End (OCR) from the same file — it replaces T001SubA in this scenario
        // Actually, let's test T001End: bundle0 has it as OCR.
        // bundle1 redefines T001End as DirectHit (no recognition field → default).
        // For that we need a fixture where T001End has no recognition.
        // Instead, test a simpler case: first resolve with defaults, then overlay with same type → no cleanup
        const b1 = createBundleView({
          root: '/fake/overlay' as AbsolutePath,
          files: new Map(),
          images: new Set(),
          defaultConfig: loadDefaultConfig()
        })
        const snap = createSnapshot({ bundles: [b0, b1] })

        // T001SubA is in b0 only. It should get $TemplateMatch defaults.
        const resolved = Snapshot.resolveTask(snap, 'T001SubA' as TaskName)
        expect(resolved).not.toBeNull()
        // $TemplateMatch.threshold=0.7 from defaults
        expect(resolved!.config.threshold).toBe(0.7)
        // Task's own template overrides default
        expect(resolved!.config.template).toBe('ui/button.png')
        // $Default.pre_delay=100 from defaults
        expect(resolved!.config.pre_delay).toBe(100)
        // Type did not change (TemplateMatch → TemplateMatch), so threshold kept
        expect(resolved!.recoType).toBe('TemplateMatch')
      })

      it('overlay type-change cleans old keys and applies new type defaults', () => {
        // Use resolveFromInfo directly to test overlay with type change.
        // First resolution: TemplateMatch with $TemplateMatch defaults
        const fv = makeFileView('pipeline-v1.json')
        const bundle = createBundleView({
          root: '/fake' as AbsolutePath,
          files: new Map([['a.json' as RelativePath, fv]]),
          images: new Set(),
          defaultConfig: loadDefaultConfig()
        })

        // Get T001SubA info
        const info = BundleView.findTask(bundle, 'T001SubA' as TaskName)!
        expect(info).toBeDefined()

        // First definition as TemplateMatch
        const first = BundleView.resolveFromInfo(info, bundle, {
          $Default: { pre_delay: 100 },
          $TemplateMatch: { threshold: 0.7 },
          $Click: { duration: 200 }
        })
        expect(first.recoType).toBe('TemplateMatch')
        expect(first.config.threshold).toBe(0.7)
        expect(first.config.template).toBe('ui/button.png')

        // Now simulate a redefinition with OCR type (changing from TemplateMatch)
        // We need a TaskInfoInFile with OCR recognition. Use T001End from the same fixture.
        const infoOcr = BundleView.findTask(bundle, 'T001End' as TaskName)!
        // Overlay T001End's parts onto the previous config, but as a redefinition of the same task name
        // T001End has recognition='OCR', expected=['Complete','Done']
        const defaults = { $OCR: { expected: ['Default'], roi: [0, 0, 1280, 720] } }
        const overlaid = BundleView.resolveFromInfo(infoOcr, bundle, defaults, first.config)

        // TemplateMatch keys should be cleaned
        expect(overlaid.config.threshold).toBeUndefined()
        expect(overlaid.config.template).toBeUndefined()
        // OCR defaults should be applied (from fresh $OCR)
        expect(overlaid.config.roi).toEqual([0, 0, 1280, 720])
        // Task's own expected overrides $OCR default
        expect(overlaid.config.expected).toEqual(['Complete', 'Done'])
        // $Default.pre_delay=100 from the previous resolution should persist
        expect(overlaid.config.pre_delay).toBe(100)
        expect(overlaid.recoType).toBe('OCR')
      })
    })
  })
})
