import { existsSync } from 'node:fs'
import * as path from 'node:path'

import { FsContentLoader, nodePathUtils, Project } from '@nekosu/maa-pipeline-manager-vnext'

import type { BaseConfig } from '../types/config'

export async function loadBundle(cfg: BaseConfig) {
  const interfacePath = path.resolve(cfg.cwd ?? process.cwd(), cfg.interfacePath)

  if (!existsSync(interfacePath)) {
    console.log(`${interfacePath} not exists`)
    return null
  }

  const project = new Project(
    new FsContentLoader(),
    nodePathUtils,
    false,
    path.dirname(interfacePath),
    cfg.parser
  )
  await project.loadInterface(path.basename(interfacePath))

  return project
}
