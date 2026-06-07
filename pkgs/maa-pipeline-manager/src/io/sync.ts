import * as fs from 'node:fs/promises'

import type { DiagnosticContext } from '../diagnostic/diagnostic'
import { LayerInfo } from '../layer/layer'
import { type ParserConfig } from '../parser/utils'
import { buildTree, parseTreeWithoutParent } from '../utils/json'
import { type AbsolutePath, type RelativePath, joinPath } from '../utils/types'
import { loadInterface } from './load-interface'
import { loadLanguageFile } from './load-language'
import { loadPipelineFile } from './load-pipeline'
import type { IContentLoader } from './loader'
import { FsContentLoader } from './loader'

export async function loadAndParse(loader: IContentLoader, file: AbsolutePath) {
  const content = await loader.get(file)
  if (typeof content !== 'string') {
    return { node: undefined, object: undefined }
  }
  const node = parseTreeWithoutParent(content)
  return { node, object: node ? buildTree(node) : undefined }
}

export async function loadProject(
  root: string,
  interfaceFile = 'interface.json',
  maa = false,
  parser?: ParserConfig
): Promise<DiagnosticContext> {
  const loader = new FsContentLoader()
  const absRoot = root as AbsolutePath
  const ifPath = joinPath(absRoot, interfaceFile)

  // 1. Load interface.json
  const ifResult = await loadInterface(loader, ifPath, maa)
  const info = {
    decls: ifResult.decls,
    refs: ifResult.refs,
    layer: new LayerInfo(loader, maa, absRoot, 'interface')
  }
  // Re-parse to populate info.layer (parseInterface needs it pre-created)
  const ifContent = await loader.get(ifPath)
  if (ifContent) {
    const ifNode = parseTreeWithoutParent(ifContent)
    if (ifNode) {
      const { parseInterface } = await import('../parser/interface/interface')
      parseInterface(ifNode, info, { maa, file: ifPath, import: false })
    }
  }

  // 2. Load imports
  const importRefs = info.refs.filter(ref => ref.type === 'interface.import_path')
  for (const ref of importRefs) {
    const importPath = joinPath(absRoot, ref.target)
    const impResult = await loadInterface(loader, importPath, maa, true)
    info.decls.push(...impResult.decls)
    info.refs.push(...impResult.refs)
  }

  // 3. Load language files
  const langs: { name: string; entries: { key: string; value: string }[] }[] = []
  const langDecls = info.decls.filter(d => d.type === 'interface.language')
  for (const langDecl of langDecls) {
    const langPath = joinPath(absRoot, langDecl.path)
    const langData = await loadLanguageFile(loader, langPath)
    langs.push({ name: langDecl.name, entries: langData.entries })
    info.layer.extraDecls.push(...langData.decls)
    info.layer.extraRefs.push(...langData.refs)
  }

  const langBundle = {
    langs,
    queryKey(key: string) {
      return langs.map(lang => lang.entries.find(e => e.key === key) ?? null)
    }
  }

  // 4. Load pipeline bundles
  const allPaths: RelativePath[] = []
  const resInfo = info.decls.find(d => d.type === 'interface.resource')
  const ctrlInfo = info.decls.find(d => d.type === 'interface.controller')
  if (resInfo) {
    allPaths.push(...resInfo.paths)
  }
  if (ctrlInfo) {
    allPaths.push(...ctrlInfo.attachs)
  }

  const layers: LayerInfo[] = []
  let prevLayer: LayerInfo | undefined = undefined
  const pipelineSuffix = maa ? 'tasks' : 'pipeline'

  for (const dir of allPaths) {
    const bundleRoot = joinPath(absRoot, dir)
    const pipelineDir = joinPath(bundleRoot, pipelineSuffix) as AbsolutePath
    const layer = new LayerInfo(loader, maa, bundleRoot, 'resource')

    // Load default_pipeline.json
    const defaultPath = joinPath(bundleRoot, 'default_pipeline.json')
    const defaultResult = await loadPipelineFile(loader, defaultPath, maa, parser, true)
    for (const entry of defaultResult.entries) {
      layer
        .mutableTaskInfo(entry.taskName)
        .push({
          file: defaultPath,
          prop: undefined as never,
          data: undefined as never,
          info: undefined as never,
          obj: entry.obj
        })
    }
    for (const cfg of defaultResult.mpeConfigs) {
      layer.extraDecls.push(cfg)
    }
    layer.markDirty()

    // Load pipeline files from directory
    try {
      const files = await fs.readdir(pipelineDir)
      for (const file of files) {
        if (file.endsWith('.json') || file.endsWith('.jsonc')) {
          const fullPath = joinPath(pipelineDir, file)
          const result = await loadPipelineFile(loader, fullPath, maa, parser)
          for (const entry of result.entries) {
            layer
              .mutableTaskInfo(entry.taskName)
              .push({
                file: fullPath,
                prop: undefined as never,
                data: undefined as never,
                info: undefined as never,
                obj: entry.obj
              })
          }
          for (const cfg of result.mpeConfigs) {
            layer.extraDecls.push(cfg)
          }
          layer.markDirty()
        }
      }
    } catch {
      // directory may not exist
    }

    layer.parent = prevLayer
    prevLayer = layer
    layers.push(layer)
  }

  if (layers.length > 0) {
    info.layer.parent = layers[layers.length - 1]
    info.layer.markDirty()
  }

  const allLayers = [...layers, info.layer]

  return { allLayers, maa, langBundle, topLayer: info.layer, decls: info.decls, refs: info.refs }
}
