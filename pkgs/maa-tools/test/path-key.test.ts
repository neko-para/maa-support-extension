import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import test from 'node:test'

import { collectTests } from '../src/test/collect.ts'
import { evaluateCase } from '../src/test/evaluate.ts'
import { captureTestFileReads, loadTestCases, readTestFile } from '../src/test/files.ts'
import { expandTestGroups } from '../src/test/plan.ts'
import { TestRunProgress } from '../src/test/progress.ts'
import { buildRunTargets, filterGroupsForFiles } from '../src/test/selection.ts'
import type { TestRunEvent } from '../src/test/types.ts'
import type { FullConfig } from '../src/types/config.ts'
import { pathKey, samePath } from '../src/utils/paths.ts'

test('Windows比较键按win32规则解析并忽略大小写和分隔符，不改输入字符串', () => {
  const original = 'C:\\Repo\\tests\\..\\tests\\A.json'
  assert.equal(pathKey(original, 'win32'), 'c:\\repo\\tests\\a.json')
  assert.equal(pathKey(original, 'win32'), pathKey('c:/repo/tests/a.json', 'win32'))
  assert.equal(
    pathKey('\\\\SERVER\\Share\\A.json', 'win32'),
    pathKey('//server/share/a.json', 'win32')
  )
  assert.equal(original, 'C:\\Repo\\tests\\..\\tests\\A.json')
})

test('非Windows来源比较保留大小写，同目录的A/a不能合并', () => {
  for (const platform of ['linux', 'darwin'] as const) {
    assert.equal(pathKey('/repo/A.json', platform), '/repo/A.json')
    assert.notEqual(pathKey('/repo/A.json', platform), pathKey('/repo/a.json', platform))
  }
})

test(
  'Windows原生来源大小写贯通targets/reads/list/plan/report/progress且不改输出路径',
  {
    skip:
      process.platform !== 'win32' ? '需要原生Windows文件系统；Linux只验证上面的路径规则' : false
  },
  async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maa-core-path-identity-'))
    t.after(() => fs.rm(root, { recursive: true, force: true }))
    const original = path.join(root, 'Cases.JSON')
    const alias = original.toLowerCase()
    await fs.writeFile(
      original,
      JSON.stringify({
        configs: { controller: 'C1', resource: 'R' },
        cases: [{ image: 'a.png', hits: ['A'] }]
      })
    )
    assert.ok(samePath(original, alias))
    const originalGroup = (await loadTestCases(original))!
    const aliasGroup = (await loadTestCases(alias))!
    assert.equal(originalGroup.cases[0].origin?.file, original)
    const captured = await captureTestFileReads(async () => {
      await readTestFile(original)
      await readTestFile(alias)
    })
    assert.equal(captured.files.size, 1)
    assert.equal(captured.files.get(pathKey(original))?.file, alias)
    const targets = await buildRunTargets([original, alias], 0)
    assert.equal(targets.length, 1)
    assert.equal(targets[0].file, original)
    assert.deepEqual(targets[0].selected, [0])
    const requested = { ...targets[0], file: alias }
    const groups = [
      originalGroup,
      { ...aliasGroup, configs: { ...aliasGroup.configs, controller: 'C2' } }
    ]
    assert.equal(filterGroupsForFiles(groups, [requested]).groups.length, 2)
    const cfg: FullConfig = { cwd: root, interfacePath: 'unused', test: { cases: groups } }
    const expanded = await expandTestGroups(cfg, { targets: [requested, targets[0]] })
    assert.equal(expanded.files.length, 1)
    assert.equal(expanded.files[0].file, alias)
    assert.deepEqual(
      expanded.files[0].cases.map(item => item.index),
      [0]
    )
    const collection = await collectTests(cfg, [original, alias])
    assert.equal(collection.files.length, 1)
    assert.equal(collection.files[0].error, undefined)
    assert.deepEqual(
      collection.files[0].cases.map(item => item.index),
      [0]
    )
    const events: TestRunEvent[] = []
    const progress = new TestRunProgress({
      files: expanded.files,
      plannedGroups: expanded.groups,
      elapsed: () => 1,
      onEvent: event => {
        events.push(event)
      }
    })
    await progress.initialize()
    assert.equal(events.length, 0)
    await progress.startCase(originalGroup.cases[0].origin)
    await progress.startCase(aliasGroup.cases[0].origin)
    for (const [index, group] of expanded.groups.entries()) {
      const imagePath = path.join(root, 'a.png')
      const result = evaluateCase(
        group.cases[0],
        imagePath,
        [
          {
            imagePath,
            imagePathRaw: 'a.png',
            node: 'A',
            hit: true,
            detail: { hit: true } as unknown as maa.RecoDetail,
            pid: 1
          }
        ],
        group.nodes!
      )
      assert.equal(result.verdict, 'pass')
      await progress.recordCase(index, 0, result)
      if (index === 0)
        assert.deepEqual(
          events.map(event => event.type),
          ['case-started']
        )
    }
    const final = await progress.finish()
    assert.equal(final.status, 'passed')
    assert.equal(final.files[0].file, alias)
    assert.equal(final.files[0].verdict, 'pass')
    assert.equal(final.files[0].cases[0].platforms.length, 2)
    assert.equal(final.files[0].cases[0].platforms[0].result.origin?.file, original)
    assert.deepEqual(
      events.map(event => event.type),
      ['case-started', 'case-result', 'file-result']
    )
    for (const event of events)
      if (event.type === 'file-result') assert.deepEqual(event.result.files[0], final.files[0])
  }
)
