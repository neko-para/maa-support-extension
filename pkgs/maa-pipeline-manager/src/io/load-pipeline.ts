import { parseTask } from '../parser/task/task'
import type { TaskDeclInfo, TaskRefInfo } from '../parser/task/task'
import { type ParserConfig, parseObject } from '../parser/utils'
import { buildTree, parseTreeWithoutParent } from '../utils/json'
import { type AbsolutePath, type TaskName } from '../utils/types'
import type { IContentLoader } from './loader'

export type PipelineFileEntry = {
  taskName: TaskName
  decls: TaskDeclInfo[]
  refs: TaskRefInfo[]
  obj: unknown
}

export async function loadPipelineFile(
  loader: IContentLoader,
  file: AbsolutePath,
  maa: boolean,
  parser?: ParserConfig,
  isDefault = false
): Promise<{ entries: PipelineFileEntry[]; mpeConfigs: TaskDeclInfo[] }> {
  const content = await loader.get(file)
  return parsePipelineContent(content ?? undefined, file, maa, parser, isDefault)
}

export function parsePipelineContent(
  content: string | undefined,
  file: AbsolutePath,
  maa: boolean,
  parser?: ParserConfig,
  isDefault = false
): { entries: PipelineFileEntry[]; mpeConfigs: TaskDeclInfo[] } {
  const entries: PipelineFileEntry[] = []
  const mpeConfigs: TaskDeclInfo[] = []

  if (typeof content !== 'string') {
    return { entries, mpeConfigs }
  }
  const tree = parseTreeWithoutParent(content)
  if (!tree || tree.type !== 'object') {
    return { entries, mpeConfigs }
  }

  for (const [key, obj, prop] of parseObject(tree)) {
    if (key.startsWith('$')) {
      if (key.startsWith('$__mpe')) {
        mpeConfigs.push({ file, location: prop, type: 'task.mpe_config' })
      }
      continue
    }
    let taskName = key as TaskName
    if (isDefault) {
      taskName = ('$' + taskName) as TaskName
    }
    const info = parseTask(obj, { maa, file, task: prop, taskName, parser })
    entries.push({ taskName, decls: info.decls, refs: info.refs, obj: buildTree(obj) })
  }

  return { entries, mpeConfigs }
}
