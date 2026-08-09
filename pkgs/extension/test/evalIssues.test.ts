import assert from 'node:assert/strict'
import test from 'node:test'

import { MaaEvalMissingIssueCollector, getBlockingMissingTasks } from '../src/utils/evalIssues.ts'

test('collects full missing task names and deduplicates repeated callbacks', () => {
  const collector = new MaaEvalMissingIssueCollector()

  collector.cannotFindTask('Base', ['Parent'])
  collector.cannotFindTask('Base', ['Parent'])
  collector.cannotFindTask('Other', [])

  assert.deepEqual(collector.take().missingTasks, ['Parent@Base', 'Other'])
})

test('keeps missing base tasks separate and clears issues after take', () => {
  const collector = new MaaEvalMissingIssueCollector()

  collector.cannotFindTask('Base', [])
  collector.warnCannotFindBaseTask('Base')
  collector.warnCannotFindBaseTask('Base')

  const issues = collector.take()
  assert.deepEqual(issues, {
    missingTasks: ['Base'],
    missingBaseTasks: ['Base']
  })
  assert.deepEqual(getBlockingMissingTasks(issues), [])
  assert.deepEqual(collector.take(), {
    missingTasks: [],
    missingBaseTasks: []
  })
})

test('only treats missing tasks without a matching base warning as blocking', () => {
  assert.deepEqual(
    getBlockingMissingTasks({
      missingTasks: ['OptionalBase', 'RequiredTask'],
      missingBaseTasks: ['OptionalBase']
    }),
    ['RequiredTask']
  )
})
