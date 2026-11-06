export type CustomRecognitionRequirement = {
  name: string
  nodes: string[]
}

/**
 * 遍历 recognition 值（原始 pipeline JSON 或有效节点定义），遇到节点名引用时回调。
 * 5.13 的有效定义是 recognition: {type, param}；5.12.x 的 And/Or 内联子项是
 * {type, param, sub_name} 平铺，必须同时兼容，否则会漏检 Custom。
 *
 * 与 `@nekosu/maa-tools` 的 test worker 是同一套判定（CLI 批量测试 vs 面板单节点识别
 * 用途不同，包边界不允许直接复用）。
 */
function visitRecognition(
  value: unknown,
  resolveNode: (node: string) => string[],
  inlineOnly = false
): string[] {
  if (!value || typeof value !== 'object') {
    return []
  }
  const node = value as { recognition?: unknown; custom_recognition?: unknown; type?: unknown }
  const recognition =
    node.recognition ?? (typeof node.type === 'string' ? (value as object) : undefined)
  const names: string[] = []

  if (typeof recognition === 'string') {
    if (
      recognition === 'Custom' &&
      typeof node.custom_recognition === 'string' &&
      node.custom_recognition
    ) {
      names.push(node.custom_recognition)
    }
    for (const key of ['all_of', 'any_of'] as const) {
      const sub = (value as Record<string, unknown>)[key]
      if (Array.isArray(sub)) {
        for (const item of sub) {
          if (typeof item === 'string') {
            if (!inlineOnly) {
              names.push(...resolveNode(item))
            }
          } else {
            names.push(...visitRecognition(item, resolveNode, inlineOnly))
          }
        }
      }
    }
    return names
  }

  if (!recognition || typeof recognition !== 'object') {
    return names
  }
  const { type, param } = recognition as { type?: unknown; param?: unknown }
  const parameters = param && typeof param === 'object' ? (param as Record<string, unknown>) : {}
  if (type === 'Custom') {
    const name = parameters.custom_recognition
    if (typeof name === 'string' && name) {
      names.push(name)
    }
    return names
  }
  if (type === 'And' || type === 'Or') {
    const sub = type === 'And' ? parameters.all_of : parameters.any_of
    if (Array.isArray(sub)) {
      for (const item of sub) {
        if (typeof item === 'string') {
          if (!inlineOnly) {
            names.push(...resolveNode(item))
          }
        } else {
          names.push(...visitRecognition(item, resolveNode, inlineOnly))
        }
      }
    }
  }
  return names
}

/** 从 `Resource.get_node_data` 返回的节点定义里取出内联的 custom 识别名（不展开节点名引用） */
export function collectCustomRecognitionNames(nodeData: string | null | undefined): string[] {
  if (!nodeData) {
    return []
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(nodeData)
  } catch {
    return []
  }
  return [...new Set(visitRecognition(parsed, () => [], true))]
}

/**
 * 汇总节点需要的 custom 识别名与引用它的根节点。
 * And/Or 的子项可以是节点名（Pipeline v5.7+），必须递归展开，否则被引用节点里的
 * Custom 识别会漏检，最终退化成识别未命中。结果按节点缓存，避免菱形引用扇出。
 */
export function requiredCustomRecognitions(
  nodes: readonly string[],
  getNodeData: (node: string) => string | null
): CustomRecognitionRequirement[] {
  /** 单条引用链允许的最大层级，防止异常数据把栈打爆 */
  const MAX_DEPTH = 256
  const cache = new Map<string, string[]>()

  const resolve = (
    node: string,
    path: Set<string>,
    depth: number
  ): { names: string[]; cyclic: boolean } => {
    const cached = cache.get(node)
    if (cached) {
      return { names: cached, cyclic: false }
    }
    if (path.has(node)) {
      return { names: [], cyclic: true }
    }
    if (depth > MAX_DEPTH) {
      throw new Error(`节点引用层级超过 ${MAX_DEPTH} 层，无法确定 Custom 识别需求：${node}`)
    }
    const data = getNodeData(node)
    if (data === null) {
      return { names: [], cyclic: false }
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(data)
    } catch {
      return { names: [], cyclic: false }
    }
    const nextPath = new Set(path)
    nextPath.add(node)
    let cyclic = false
    const names = visitRecognition(parsed, child => {
      const result = resolve(child, nextPath, depth + 1)
      if (result.cyclic) {
        cyclic = true
      }
      return result.names
    })
    const unique = [...new Set(names)]
    if (!cyclic) {
      cache.set(node, unique)
    }
    return { names: unique, cyclic }
  }

  const owners = new Map<string, string[]>()
  for (const node of nodes) {
    const { names } = resolve(node, new Set(), 0)
    for (const name of names) {
      const list = owners.get(name) ?? []
      if (!list.includes(node)) {
        list.push(node)
      }
      owners.set(name, list)
    }
  }
  return [...owners].map(([name, roots]) => ({ name, nodes: roots }))
}
