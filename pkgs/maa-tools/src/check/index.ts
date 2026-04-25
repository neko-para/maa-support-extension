import { error as coreError, warning as coreWarning, endGroup, startGroup } from '@actions/core'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
  type Diagnostic,
  buildDiagnosticMessage,
  joinPath,
  performDiagnostic
} from '@nekosu/maa-pipeline-manager'

import type { FullConfig } from '../types/config'
import { loadBundle } from '../utils/bundle'
import { loadMaa, setupMaa } from '../utils/maa'
import { calucateLocation } from './utils'

export async function runCheck(cfg: FullConfig): Promise<boolean> {
  if (!cfg.check) {
    return false
  }

  const modulePath = await setupMaa(cfg)
  if (!modulePath) {
    return false
  }
  await loadMaa(modulePath, path.resolve(cfg.cwd ?? process.cwd(), cfg.maaLogDir ?? '.'))
  if (cfg.maaStdoutLevel) {
    maa.Global.stdout_level = cfg.maaStdoutLevel
  }

  const repo = path.resolve(cfg.cwd ?? process.cwd(), cfg.repo ?? '.')

  const result: Diagnostic[] = []

  const bundle = await loadBundle(cfg)
  if (!bundle) {
    return false
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

  let loadResourceFailed = false

  const ctrlNames = bundle.allControllerNames()
  for (const ctrlName of ctrlNames) {
    const resNames = bundle.allResourceNames(ctrlName)
    for (const resName of resNames) {
      await bundle.switchActive(ctrlName, resName)

      if (!cfg.mode || cfg.mode === 'stdio') {
        console.log(`${ctrlName} ${resName}`)
      } else if (cfg.mode === 'github') {
        startGroup(`${ctrlName} ${resName}`)
      }

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

      for (const diag of currDiags) {
        const [start, _end, brief] = await buildDiagnosticMessage(bundle.root, diag, locate, {})

        const [line, col] = start
        const relative = path.relative(repo, diag.file)
        switch (cfg.mode ?? 'stdio') {
          case 'stdio':
            console.log(`  ${diag.level}: ${relative}:${line}:${col} ${brief}`)
            break
          case 'github':
            switch (diag.level) {
              case 'warning':
                coreWarning(brief, {
                  file: relative,
                  startLine: line,
                  startColumn: col,
                  endColumn: col + diag.length
                })
                break
              case 'error':
                coreError(brief, {
                  file: relative,
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

      const res = new maa.Resource()
      for (const folder of bundle.paths) {
        const succ = await res.post_bundle(joinPath(bundle.root, folder)).wait().succeeded
        if (!succ) {
          if (!cfg.mode || cfg.mode === 'stdio') {
            console.error('  load resource failed')
          } else if (cfg.mode === 'github') {
            coreError('  load resource failed')
          }
          loadResourceFailed = true
        }
      }
      res.destroy()
    }
  }

  if (cfg.mode === 'json') {
    process.stdout.write(JSON.stringify(result))
    return true
  }

  const hasError = result.some(diag => diag.level === 'error')
  return !hasError && !loadResourceFailed
}
