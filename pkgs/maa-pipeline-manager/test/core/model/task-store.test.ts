import type { Node } from 'jsonc-parser'
import { describe, expect, test } from 'vitest'

import { TaskStore } from '../../../src/core/model/task-store'
import type { LayerTaskInfo } from '../../../src/layer/layer'
import type { AbsolutePath, TaskName } from '../../../src/utils/types'

function mockTaskInfo(overrides: Partial<LayerTaskInfo> = {}): LayerTaskInfo {
  return {
    file: '/test/tasks.json' as AbsolutePath,
    prop: { type: 'string', value: 'TestTask', offset: 0, length: 10 } as Node,
    data: {} as Node,
    info: {
      parts: { node: {} as Node, base: [], reco: [], act: [], unknown: [] },
      decls: [],
      refs: []
    },
    obj: {},
    ...overrides
  } as LayerTaskInfo
}

describe('TaskStore', () => {
  test('add and get', () => {
    const store = new TaskStore()
    store.mutableInfo('TaskA' as TaskName).push(mockTaskInfo())
    expect(store.tasks['TaskA' as TaskName]).toHaveLength(1)
  })

  test('list excludes $ prefix', () => {
    const store = new TaskStore()
    store.mutableInfo('TaskA' as TaskName).push(mockTaskInfo())
    store.mutableInfo('$Default' as TaskName).push(mockTaskInfo())
    expect(store.list()).toEqual(['TaskA'])
  })

  test('removeFile', () => {
    const store = new TaskStore()
    store.mutableInfo('TaskA' as TaskName).push(mockTaskInfo({ file: '/a.json' as AbsolutePath }))
    store.mutableInfo('TaskB' as TaskName).push(mockTaskInfo({ file: '/b.json' as AbsolutePath }))
    store.removeFile('/a.json' as AbsolutePath)
    expect(store.list()).toEqual(['TaskB'])
  })

  test('removeFile deletes key when empty', () => {
    const store = new TaskStore()
    store.mutableInfo('TaskA' as TaskName).push(mockTaskInfo({ file: '/a.json' as AbsolutePath }))
    store.removeFile('/a.json' as AbsolutePath)
    expect(store.tasks['TaskA' as TaskName]).toBeUndefined()
  })

  test('collectDecls', () => {
    const store = new TaskStore()
    store.mutableInfo('TaskA' as TaskName).push(
      mockTaskInfo({
        info: {
          parts: { node: {} as Node, base: [], reco: [], act: [], unknown: [] },
          decls: [
            {
              type: 'task.decl',
              task: 'TaskA' as TaskName,
              tasks: [],
              file: '/a.json' as AbsolutePath,
              location: {} as Node
            }
          ],
          refs: []
        }
      })
    )
    expect(store.collectDecls()).toHaveLength(1)
  })
})
