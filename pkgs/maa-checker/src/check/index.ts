import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
  type Diagnostic,
  FsContentLoader,
  FsContentWatcher,
  InterfaceBundle,
  buildDiagnosticMessage,
  performDiagnostic
} from '@nekosu/maa-pipeline-manager'

import type { FullConfig } from '../types/config'
import { calucateLocation } from './utils'

export async function runCheck(cfg: FullConfig): Promise<boolean> {
  if (!cfg.check) {
    return false
  }

  const result: Diagnostic[] = []

  const bundle = new InterfaceBundle(
    new FsContentLoader(),
    new FsContentWatcher(),
    false,
    path.dirname(cfg.check.interfacePath),
    path.basename(cfg.check.interfacePath)
  )
  await bundle.load()
  await bundle.flush(false) // 刷下 imports

  const ctrlNames = bundle.allControllerNames()

  for (const ctrlName of ctrlNames) {
    const resNames = bundle.allResourceNames(ctrlName)
    for (const resName of resNames) {
      await bundle.switchActive(ctrlName, resName)

      const rawDiags = performDiagnostic(bundle, {})
      for (const diag of rawDiags) {
        const override = cfg.check.override?.[diag.type]
        if (override === 'ignore') {
          continue
        }
        if (override) {
          result.push({
            ...diag,
            level: override
          })
        } else {
          result.push(diag)
        }
      }
    }
  }

  const files: Record<string, string> = {}

  const locate = async (file: string, offset: number) => {
    let content = files[file]
    if (!content) {
      content = await fs.readFile(file, 'utf8')
      files[file] = content
    }
    return calucateLocation(content, offset)
  }

  for (const diag of result) {
    const [start, _end, brief] = await buildDiagnosticMessage(bundle.root, diag, locate, {})

    const [line, col] = start
    const relative = path.relative(bundle.root, diag.file)
    // if (option.githubMode) {
    //   core[diag.level](brief, {
    //     file: path.relative(option.repoFolder, diag.file),
    //     startLine: line,
    //     startColumn: col,
    //     endColumn: col + diag.length
    //   })
    // } else {
    console.log(`  ${diag.level}: ${relative}:${line}:${col} ${brief}`)
    // }
  }

  return result.length === 0
}
