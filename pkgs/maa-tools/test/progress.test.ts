import assert from 'node:assert/strict'
import * as path from 'node:path'
import test from 'node:test'

import { groupVerdict } from '../src/test/evaluate.ts'
import { TestRunProgress } from '../src/test/progress.ts'
import type {
  ListedFile,
  RecoJobOutcome,
  TestCaseRunResult,
  TestGroupRunResult,
  TestRunEvent,
  TestRunResult
} from '../src/test/types.ts'
import { createRecoJobs } from '../src/test/utils.ts'
import type { TestCases } from '../src/types/config.ts'

const fileA = path.resolve('live-tests/a.json')
const fileB = path.resolve('live-tests/b.json')
const fileC = path.resolve('live-tests/c.json')
const imagePath = path.resolve('live-images/shared.png')

type ResultEvent = Exclude<TestRunEvent, { type: 'case-started' }>

function metadata(file = fileA, indexes = [0]): ListedFile {
  return {
    file,
    name: 'same display name',
    controllers: ['C1', 'C2'],
    resources: ['R'],
    cases: indexes.map(index => ({
      index,
      name: `case ${index}`,
      image: 'shared.png',
      hits: ['A'],
      start: index * 50,
      end: index * 50 + 40
    }))
  }
}

function planned(file = fileA, indexes = [0], controller = 'C1'): TestCases {
  return {
    configs: { name: 'same display name', controller, resource: 'R' },
    nodes: ['A', 'B'],
    cases: indexes.map(index => ({
      image: 'shared.png',
      hits: ['A'],
      origin: { file, case: index }
    }))
  }
}

function caseResult(
  file = fileA,
  index = 0,
  verdict: TestCaseRunResult['verdict'] = 'pass',
  durationMs = 10
): TestCaseRunResult {
  return {
    image: 'shared.png',
    imagePath,
    origin: { file, case: index },
    verdict,
    checks:
      verdict === 'skipped' || verdict === 'error'
        ? []
        : [
            {
              node: 'A',
              expected: 'hit',
              hit: verdict === 'pass',
              detail: null,
              ok: verdict === 'pass'
            }
          ],
    durationMs,
    ...(verdict === 'error' ? { error: 'no nodes to check' } : {})
  }
}

function coordinator(files: ListedFile[], groups: TestCases[], events: TestRunEvent[]) {
  return new TestRunProgress({
    files,
    plannedGroups: groups,
    onEvent: event => {
      events.push(event)
    },
    elapsed: () => 123
  })
}

function completed(events: TestRunEvent[]): ResultEvent[] {
  return events.filter((event): event is ResultEvent => event.type !== 'case-started')
}

function matchingGroups(groups: TestGroupRunResult[], file: string, caseIndex?: number) {
  return groups.flatMap(group => {
    const cases = group.cases.filter(
      result =>
        result.origin?.file === file &&
        (caseIndex === undefined || result.origin.case === caseIndex)
    )
    return cases.length === 0
      ? []
      : [
          {
            ...group,
            cases,
            verdict: groupVerdict(cases),
            durationMs: cases.reduce((sum, result) => sum + result.durationMs, 0)
          }
        ]
  })
}

function assertConsistent(events: TestRunEvent[], final: TestRunResult) {
  for (const event of completed(events)) {
    const file = event.type === 'case-result' ? event.origin.file : event.file
    const expected = final.files.find(result => result.file === file)
    assert.ok(expected)
    assert.equal(event.result.files.length, 1)
    if (event.type === 'case-result') {
      assert.deepEqual(event.result.files[0].selectedCases, [event.origin.case])
      assert.deepEqual(
        event.result.files[0].cases,
        expected.cases.filter(result => result.index === event.origin.case)
      )
    } else {
      assert.deepEqual(event.result.files[0], expected)
    }
    assert.deepEqual(
      event.result.groups,
      matchingGroups(
        final.groups,
        file,
        event.type === 'case-result' ? event.origin.case : undefined
      )
    )
  }
}

test('同origin跨平台：只开始一次，最后一个计划平台完成才发布case与file', async () => {
  const events: TestRunEvent[] = []
  const progress = coordinator([metadata()], [planned(), planned(fileA, [0], 'C2')], events)
  await progress.initialize()
  await progress.startCase({ file: fileA, case: 0 })
  await progress.startCase({ file: fileA, case: 0 })
  await progress.recordCase(0, 0, caseResult())
  assert.deepEqual(
    events.map(event => event.type),
    ['case-started']
  )
  await progress.recordCase(1, 0, caseResult(fileA, 0, 'fail', 20))
  assert.deepEqual(
    events.map(event => event.type),
    ['case-started', 'case-result', 'file-result']
  )
  const final = await progress.finish()
  assert.equal(final.status, 'failed')
  assert.equal(final.files[0].cases[0].durationMs, 30)
  assertConsistent(events, final)
})

test('节点块乱序：等本图全部块完成即发布，不等同组其它图片', async () => {
  const events: TestRunEvent[] = []
  const group = planned(fileA, [0, 1])
  group.cases[1].image = 'slow.png'
  const progress = coordinator([metadata(fileA, [0, 1])], [group], events)
  const gates = [Promise.withResolvers<RecoJobOutcome>(), Promise.withResolvers<RecoJobOutcome>()]
  const submitted = Promise.withResolvers<void>()
  let submittedCount = 0
  const jobs = createRecoJobs([{ image: 'shared.png', imagePath }], group.nodes!, 1)
  const run = progress.runImage(0, [0], jobs, job => {
    submittedCount += 1
    if (submittedCount === 2) {
      submitted.resolve()
    }
    return gates[job.nodes[0] === 'A' ? 0 : 1].promise
  })
  await submitted.promise
  gates[1].resolve({
    results: [
      {
        imagePath,
        imagePathRaw: 'shared.png',
        node: 'B',
        hit: false,
        detail: { hit: false } as unknown as maa.RecoDetail,
        pid: 1
      }
    ],
    durationMs: 7
  })
  await Promise.resolve()
  assert.equal(completed(events).length, 0)
  gates[0].resolve({
    results: [
      {
        imagePath,
        imagePathRaw: 'shared.png',
        node: 'A',
        hit: true,
        detail: { hit: true } as unknown as maa.RecoDetail,
        pid: 1
      }
    ],
    durationMs: 5
  })
  await run
  assert.deepEqual(
    completed(events).map(event => event.type),
    ['case-result']
  )
  const event = completed(events)[0]
  assert.equal(event.type, 'case-result')
  assert.equal(event.result.files[0].cases[0].verdict, 'pass')
  assert.equal(event.result.files[0].cases[0].durationMs, 12)
  await progress.recordCase(0, 1, caseResult(fileA, 1))
  assertConsistent(events, await progress.finish())
})

test('并行图片可先完成后提交的用例，最终文件和组仍保持原始下标顺序', async () => {
  const events: TestRunEvent[] = []
  const progress = coordinator([metadata(fileA, [0, 2, 5])], [planned(fileA, [0, 2, 5])], events)
  await progress.recordCase(0, 2, caseResult(fileA, 5))
  await progress.recordCase(0, 0, caseResult(fileA, 0, 'fail'))
  assert.equal(completed(events).filter(event => event.type === 'file-result').length, 0)
  await progress.recordCase(0, 1, caseResult(fileA, 2))
  const final = await progress.finish()
  assert.deepEqual(
    events.flatMap(event => (event.type === 'case-result' ? [event.origin.case] : [])),
    [5, 0, 2]
  )
  assert.deepEqual(final.files[0].selectedCases, [0, 2, 5])
  assert.deepEqual(
    final.groups[0].cases.map(result => result.origin?.case),
    [0, 2, 5]
  )
  const passingSnapshot = events.find(
    event => event.type === 'case-result' && event.origin.case === 2
  ) as ResultEvent
  assert.equal(passingSnapshot.result.status, 'passed')
  assert.equal(passingSnapshot.result.groups[0].verdict, 'pass')
  assert.equal(passingSnapshot.result.groups[0].durationMs, 10)
  assertConsistent(events, final)
})

test('同图复用只提交一次节点批次，各自保留负例和框期望并均分耗时', async () => {
  const events: TestRunEvent[] = []
  const group = planned(fileA, [0, 1, 2])
  group.cases[1].image = './shared.png'
  group.cases[1].hits = []
  group.cases[2].hits = [{ node: 'A', box: [20, 20, 10, 10] }]
  const progress = coordinator([metadata(fileA, [0, 1, 2])], [group], events)
  const jobs = createRecoJobs(
    group.cases.map(testCase => ({ image: testCase.image, imagePath })),
    group.nodes!,
    50
  )
  let submissions = 0
  await progress.runImage(0, [0, 1, 2], jobs, async job => {
    submissions += 1
    return {
      results: job.nodes.map(node => ({
        imagePath,
        imagePathRaw: job.imagePathRaw,
        node,
        hit: node === 'A',
        detail: { hit: node === 'A', box: [0, 0, 5, 5] } as unknown as maa.RecoDetail,
        pid: 1
      })),
      durationMs: 31
    }
  })
  const final = await progress.finish()
  assert.equal(submissions, 1)
  assert.deepEqual(
    final.files[0].cases.map(result => result.verdict),
    ['pass', 'fail', 'fail']
  )
  assert.equal(final.groups[0].durationMs, 31)
  assert.equal(
    final.files[0].cases.reduce((sum, result) => sum + result.durationMs, 0),
    31
  )
  assertConsistent(events, final)
})

test('正例块成功但负例块未返回结果：即时快照也补no-result，不提前判通过', async () => {
  const events: TestRunEvent[] = []
  const group = planned()
  const progress = coordinator([metadata()], [group], events)
  const jobs = createRecoJobs([{ image: 'shared.png', imagePath }], group.nodes!, 1)
  await progress.runImage(0, [0], jobs, async job => ({
    results:
      job.nodes[0] === 'A'
        ? [
            {
              imagePath,
              imagePathRaw: 'shared.png',
              node: 'A',
              hit: true,
              detail: { hit: true } as unknown as maa.RecoDetail,
              pid: 1
            }
          ]
        : [],
    durationMs: 5
  }))
  const final = await progress.finish()
  const missing = final.files[0].cases[0].platforms[0].result.checks.find(
    check => check.node === 'B'
  )!
  assert.equal(missing.expected, 'miss')
  assert.equal(missing.reason, 'no-result')
  assert.equal(final.status, 'failed')
  assertConsistent(events, final)
})

test('同名文件/组由origin区分，混合组的文件快照只含该文件并重算组结论', async () => {
  const events: TestRunEvent[] = []
  const group = planned()
  group.cases.push(planned(fileB).cases[0])
  const progress = coordinator([metadata(), metadata(fileB)], [group], events)
  await progress.recordCase(0, 0, caseResult(fileA, 0, 'fail'))
  await progress.recordCase(0, 1, caseResult(fileB))
  const final = await progress.finish()
  const second = events.find(
    event => event.type === 'file-result' && event.file === fileB
  ) as ResultEvent
  assert.equal(second.result.status, 'passed')
  assert.equal(second.result.groups[0].cases.length, 1)
  assert.equal(second.result.groups[0].verdict, 'pass')
  assertConsistent(events, final)
})

test('重复同平台计划也按实际槽位计数，不能用平台标签提前结束', async () => {
  const events: TestRunEvent[] = []
  const progress = coordinator([metadata()], [planned(), planned()], events)
  await progress.recordCase(1, 0, caseResult(fileA, 0, 'skipped', 0))
  assert.equal(events.length, 0)
  await progress.recordCase(0, 0, caseResult())
  const final = await progress.finish()
  assert.equal(final.files[0].verdict, 'pass')
  assert.equal(final.files[0].cases[0].verdict, 'skipped')
  assertConsistent(events, final)
})

test('缺图和无节点直接完成，不发伪造started；等待其它真实平台后才结束', async () => {
  const events: TestRunEvent[] = []
  const progress = coordinator([metadata()], [planned(), planned(fileA, [0], 'C2')], events)
  await progress.initialize()
  await progress.recordCase(0, 0, caseResult(fileA, 0, 'skipped', 0))
  assert.equal(events.length, 0)
  await progress.recordCase(1, 0, caseResult(fileA, 0, 'error', 0))
  const final = await progress.finish()
  assert.equal(final.status, 'error')
  assert.deepEqual(
    events.map(event => event.type),
    ['case-result', 'file-result']
  )
  assertConsistent(events, final)
})

test('坏文件/空文件/显式选择但无计划都有完成事件，保留所选下标和完整元数据', async () => {
  const events: TestRunEvent[] = []
  const bad = { ...metadata(fileB, []), error: 'invalid json' }
  const empty = metadata(fileC, [])
  const progress = coordinator([metadata(fileA, [2]), bad, empty], [], events)
  await progress.initialize()
  const final = await progress.finish()
  assert.equal(events.filter(event => event.type === 'case-started').length, 0)
  assert.equal(events.filter(event => event.type === 'case-result').length, 1)
  assert.equal(events.filter(event => event.type === 'file-result').length, 3)
  assert.deepEqual(final.files[0].selectedCases, [2])
  assert.equal(final.files[1].error, 'invalid json')
  assertConsistent(events, final)
})

test('零匹配的单条快照仍为empty并完整保留选择，最终也为empty', async () => {
  const events: TestRunEvent[] = []
  const progress = coordinator([metadata(fileA, [4])], [], events)
  await progress.initialize()
  const final = await progress.finish()
  assert.equal(final.status, 'empty')
  for (const event of completed(events)) {
    assert.equal(event.result.status, 'empty')
    assert.equal(event.result.errorCode, 'no-tests-matched')
    assert.deepEqual(event.result.files[0].selectedCases, [4])
  }
  assertConsistent(events, final)
})

test('先完成error/skip/空文件，后续fatal不会改写已发布事实和reason', async () => {
  const events: TestRunEvent[] = []
  const empty = path.resolve('live-tests/empty.json')
  const excluded = path.resolve('live-tests/excluded.json')
  const bad = path.resolve('live-tests/bad.json')
  const progress = coordinator(
    [
      metadata(),
      metadata(fileB),
      metadata(fileC, [0, 1]),
      metadata(empty, []),
      metadata(excluded),
      { ...metadata(bad, []), error: 'bad file' }
    ],
    [planned(), planned(fileB), planned(fileC, [0, 1])],
    events
  )
  await progress.initialize()
  await progress.recordCase(0, 0, caseResult(fileA, 0, 'error', 0))
  await progress.recordCase(1, 0, caseResult(fileB, 0, 'skipped', 0))
  await progress.recordCase(2, 0, caseResult(fileC))
  const before = structuredClone(events)
  const final = await progress.finish('test-execution-failed', 'later worker failure')
  assert.equal(final.status, 'error')
  assert.equal(final.errorCode, 'test-execution-failed')
  assert.deepEqual(events.slice(0, before.length), before)
  assert.equal(final.files[0].cases[0].reason, 'no nodes to check')
  assert.equal(final.files[1].cases[0].reason, 'missing-image')
  assert.equal(final.files[1].reason, 'no-tests-verified')
  assert.equal(final.files[2].cases[1].verdict, 'error')
  assert.equal(final.files[2].cases[1].reason, 'later worker failure')
  assert.equal(final.files[3].reason, 'no-tests-verified')
  assert.equal(final.files[4].cases[0].reason, 'no-result')
  assertConsistent(events, final)
})

test('启动失败也为每个选择发完整完成快照，finish可重复等待但不重复发布', async () => {
  const events: TestRunEvent[] = []
  const progress = coordinator([metadata(fileA, [2])], [planned(fileA, [2])], events)
  const final = await progress.finish('maa-setup-failed', 'setup unavailable')
  assert.equal(final.status, 'error')
  assert.equal(final.files[0].cases[0].reason, 'setup unavailable')
  const count = events.length
  assert.deepEqual(await progress.finish(), final)
  assert.equal(events.length, count)
  assertConsistent(events, final)
})

test('异步onEvent顺序等待：开始通知完成后才能发完成，文件通知最后返回', async () => {
  const events: TestRunEvent[] = []
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const progress = new TestRunProgress({
    files: [metadata()],
    plannedGroups: [planned()],
    elapsed: () => 1,
    onEvent: async event => {
      events.push(event)
      if (event.type === 'case-started') {
        entered.resolve()
        await release.promise
      }
    }
  })
  const start = progress.startCase({ file: fileA, case: 0 })
  await entered.promise
  const record = progress.recordCase(0, 0, caseResult())
  const finish = progress.finish()
  await Promise.resolve()
  assert.deepEqual(
    events.map(event => event.type),
    ['case-started']
  )
  release.resolve()
  await Promise.all([start, record, finish])
  assert.deepEqual(
    events.map(event => event.type),
    ['case-started', 'case-result', 'file-result']
  )
})

test('通知回调抛错只记录一次并停发，最终测试结论不变', async t => {
  const log = t.mock.method(console, 'error', () => {})
  let callbacks = 0
  const progress = new TestRunProgress({
    files: [metadata()],
    plannedGroups: [planned()],
    elapsed: () => 1,
    onEvent: async () => {
      callbacks += 1
      throw new Error('observer disconnected')
    }
  })
  await progress.startCase({ file: fileA, case: 0 })
  await progress.recordCase(0, 0, caseResult())
  assert.equal((await progress.finish()).status, 'passed')
  assert.equal(callbacks, 1)
  assert.equal(log.mock.callCount(), 1)
})

test('回调修改origin、检查和快照数组不会污染后续事件或最终结果', async () => {
  const progress = new TestRunProgress({
    files: [metadata()],
    plannedGroups: [planned()],
    elapsed: () => 1,
    onEvent: event => {
      if (event.type === 'case-started' || event.type === 'case-result') {
        event.origin.case = 999
      }
      if (event.type !== 'case-started') {
        event.result.files[0].cases[0].verdict = 'fail'
        event.result.groups[0].cases[0].checks[0].ok = false
        event.result.groups.length = 0
      }
    }
  })
  await progress.startCase({ file: fileA, case: 0 })
  await progress.recordCase(0, 0, caseResult())
  const final = await progress.finish()
  assert.equal(final.status, 'passed')
  assert.equal(final.files[0].cases[0].index, 0)
  assert.equal(final.groups[0].cases[0].origin?.case, 0)
  assert.equal(final.groups[0].cases[0].checks[0].ok, true)
})

test('没有onEvent就不构建快照；没有origin的库调用仍返回真实groups', async () => {
  const group = planned()
  group.cases[0].origin = undefined
  const progress = new TestRunProgress({ files: [], plannedGroups: [group], elapsed: () => 1 })
  progress.snapshot = () => {
    throw new Error('No snapshot should be built')
  }
  await progress.startCase(undefined)
  await progress.recordCase(0, 0, { ...caseResult(), origin: undefined })
  const final = await progress.finish()
  assert.equal(final.status, 'passed')
  assert.deepEqual(final.files, [])
  assert.equal(final.groups.length, 1)
})
