import { type TaskParseContext, parseTask } from '../../../src/parser/task/task'
import { type StringNode, parseObject } from '../../../src/parser/utils'
import { parseTreeWithoutParent } from '../../../src/utils/json'
import type { AbsolutePath, TaskName } from '../../../src/utils/types'

export function parseTaskFromJson(json: string, maa = false) {
  const tree = parseTreeWithoutParent(json)
  if (!tree || tree.type !== 'object') {
    throw new Error('Expected object at root')
  }
  const [key, obj, prop] = [...parseObject(tree)][0]
  const ctx: TaskParseContext = {
    maa,
    file: '/test/tasks.json' as AbsolutePath,
    task: key as unknown as StringNode,
    taskName: prop.value as TaskName
  }
  return { info: parseTask(obj, ctx), prop: key as unknown as StringNode }
}

export function findRef<T extends { type: string }>(refs: T[], type: T['type']): T[] {
  return refs.filter(r => r.type === type)
}
