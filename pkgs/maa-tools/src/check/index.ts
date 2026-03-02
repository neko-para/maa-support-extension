import { error as coreError, warning as coreWarning, endGroup, startGroup } from '@actions/core'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
  type Diagnostic,
  buildDiagnosticMessage,
  performDiagnostic
} from '@nekosu/maa-pipeline-manager'

import type { FullConfig } from '../types/config'
import { loadBundle } from '../utils/bundle'
import { calucateLocation } from './utils'

export async function runCheck(cfg: FullConfig): Promise<boolean> {
  if (!cfg.check) {
    return false
  }

  const repo = path.resolve(cfg.cwd ?? process.cwd(), cfg.repo ?? '.')

  const result: Diagnostic[] = []

  const bundle = await loadBundle(path.resolve(cfg.cwd ?? process.cwd(), cfg.check.interfacePath))

  const files: Record<string, string> = {}
  const locate = async (file: string, offset: number) => {
    let content = files[file]
    if (!content) {
      content = await fs.readFile(file, 'utf8')
      files[file] = content
    }
    return calucateLocation(content, offset)
  }

  const ctrlNames = bundle.allControllerNames()
  for (const ctrlName of ctrlNames) {
    const resNames = bundle.allResourceNames(ctrlName)
    for (const resName of resNames) {
      await bundle.switchActive(ctrlName, resName)

      const rawDiags = performDiagnostic(bundle, {})
      const currDiags: Diagnostic[] = []
      for (const diag of rawDiags) {
        const override = cfg.check.override?.[diag.type]
        if (override === 'ignore') {
          continue
        }
        if (override) {
          currDiags.push({
            ...diag,
            level: override
          })
        } else {
          currDiags.push(diag)
        }
      }

      if (cfg.mode === 'github') {
        startGroup(`${ctrlName} ${resName}`)
      }
      for (const diag of currDiags) {
        const [start, _end, brief] = await buildDiagnosticMessage(bundle.root, diag, locate, {})

        const [line, col] = start
        const relative = path.relative(bundle.root, diag.file)
        switch (cfg.mode ?? 'stdio') {
          case 'stdio':
            console.log(`  ${diag.level}: ${relative}:${line}:${col} ${brief}`)
            break
          case 'github':
            switch (diag.level) {
              case 'warning':
                coreWarning(brief, {
                  file: path.relative(repo, diag.file),
                  startLine: line,
                  startColumn: col,
                  endColumn: col + diag.length
                })
                break
              case 'error':
                coreError(brief, {
                  file: path.relative(repo, diag.file),
                  startLine: line,
                  startColumn: col,
                  endColumn: col + diag.length
                })
                break
            }
        }
      }
      if (cfg.mode === 'github') {
        endGroup()
      }

      result.push(...currDiags)
    }
  }

  if (cfg.mode === 'json') {
    process.stdout.write(JSON.stringify(result))
    return true
  }

  return result.length === 0
}
