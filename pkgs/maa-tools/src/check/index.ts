import { error as coreError, warning as coreWarning, endGroup, startGroup } from '@actions/core'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  type Diagnostic,
  FsContentWatcher,
  type InterfaceBundle,
  buildDiagnosticMessage,
  joinPath,
  performDiagnostic
} from '@nekosu/maa-pipeline-manager'

import type { FullConfig } from '../types/config'
import { CachedContentLoader, loadBundle } from '../utils/bundle'
import { loadMaa, setupMaa } from '../utils/maa'
import { calucateLocation } from './utils'

type CheckTarget = {
  controller: string
  resource: string
  labels: string[]
}

type CheckResult = {
  target: CheckTarget
  diagnostics: Diagnostic[]
  failedResourcePaths: string[]
}

function buildCheckTargets(bundle: InterfaceBundle) {
  const targets = new Map<string, CheckTarget>()
  for (const controller of bundle.allControllerNames()) {
    for (const resource of bundle.allResourceNames(controller)) {
      const paths = bundle.resolvePaths(controller, resource)
      const key = JSON.stringify(paths)
      const target = targets.get(key)
      const label = `${controller} ${resource}`
      if (target) {
        target.labels.push(label)
      } else {
        targets.set(key, {
          controller,
          resource,
          labels: [label]
        })
      }
    }
  }
  return [...targets.values()]
}

function applyOverrides(cfg: FullConfig, diagnostics: Diagnostic[]) {
  const result: Diagnostic[] = []
  for (const diagnostic of diagnostics) {
    const override = cfg.check?.override?.[diagnostic.type]
    if (override === 'ignore') {
      continue
    }
    if (override) {
      result.push({
        ...diagnostic,
        level: override
      })
    } else {
      result.push(diagnostic)
    }
  }
  return result
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>
) {
  const results = new Array<R>(values.length)
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(values[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

function resolveJobs(configuredJobs: number | undefined, targetCount: number) {
  if (targetCount === 0) {
    return 0
  }

  const defaultJobs = Math.min(4, os.availableParallelism())
  const requestedJobs =
    configuredJobs !== undefined && Number.isFinite(configuredJobs) && configuredJobs >= 1
      ? Math.floor(configuredJobs)
      : defaultJobs
  return Math.min(targetCount, requestedJobs)
}

async function checkTarget(
  cfg: FullConfig,
  target: CheckTarget,
  loader: CachedContentLoader,
  watcher: FsContentWatcher
): Promise<CheckResult> {
  const bundle = await loadBundle(cfg, loader, watcher)
  if (!bundle) {
    throw new Error('failed to reload interface bundle')
  }

  try {
    await bundle.switchActive(target.controller, target.resource)
    const diagnostics = applyOverrides(cfg, performDiagnostic(bundle, {}))
    const failedResourcePaths: string[] = []
    const resource = new maa.Resource()
    try {
      for (const folder of bundle.paths) {
        const succeeded = await resource.post_bundle(joinPath(bundle.root, folder)).wait().succeeded
        if (!succeeded) {
          failedResourcePaths.push(folder)
        }
      }
    } finally {
      resource.destroy()
    }

    return {
      target,
      diagnostics,
      failedResourcePaths
    }
  } finally {
    bundle.stop()
  }
}

export async function runCheck(cfg: FullConfig): Promise<boolean> {
  if (!cfg.check) {
    return false
  }

  const modulePath = await setupMaa(cfg)
  if (!modulePath) {
    return false
  }
  await loadMaa(modulePath, path.resolve(cfg.cwd ?? process.cwd(), cfg.maaLogDir ?? 'debug'))
  if (cfg.maaStdoutLevel) {
    maa.Global.stdout_level = cfg.maaStdoutLevel
  }

  const repo = path.resolve(cfg.cwd ?? process.cwd(), cfg.repo ?? '.')

  const result: Diagnostic[] = []

  const loader = new CachedContentLoader()
  const watcher = new FsContentWatcher()
  const bundle = await loadBundle(cfg, loader, watcher)
  if (!bundle) {
    return false
  }

  const targets = buildCheckTargets(bundle)
  const bundleRoot = bundle.root
  bundle.stop()

  const jobs = resolveJobs(cfg.check.job, targets.length)

  if ((!cfg.mode || cfg.mode === 'stdio') && targets.length > 0) {
    console.log(`checking ${targets.length} unique resource sets with ${jobs} jobs`)
  }

  const checkResults = await mapConcurrent(targets, jobs, target => {
    return checkTarget(cfg, target, loader, watcher)
  })

  const files = new Map<string, Promise<string>>()
  const locate = async (file: string, offset: number) => {
    let content = files.get(file)
    if (!content) {
      content = fs.readFile(file, 'utf8')
      files.set(file, content)
    }
    return calucateLocation(await content, offset)
  }

  let loadResourceFailed = false

  for (const checkResult of checkResults) {
    const label = checkResult.target.labels.join(', ')
    if (!cfg.mode || cfg.mode === 'stdio') {
      console.log(label)
    } else if (cfg.mode === 'github') {
      startGroup(label)
    }

    const formattedDiagnostics = await Promise.all(
      checkResult.diagnostics.map(async diagnostic => {
        const message = await buildDiagnosticMessage(bundleRoot, diagnostic, locate, {})
        return [diagnostic, message] as const
      })
    )

    for (const [diag, [start, _end, brief]] of formattedDiagnostics) {
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

    for (const failedPath of checkResult.failedResourcePaths) {
      const message = `load resource failed: ${failedPath}`
      if (!cfg.mode || cfg.mode === 'stdio') {
        console.error(`  ${message}`)
      } else if (cfg.mode === 'github') {
        coreError(message)
      }
      loadResourceFailed = true
    }

    if (cfg.mode === 'github') {
      endGroup()
    }

    result.push(...checkResult.diagnostics)
  }

  if (cfg.mode === 'json') {
    process.stdout.write(JSON.stringify(result))
    return true
  }

  const hasError = result.some(diag => diag.level === 'error')
  return !hasError && !loadResourceFailed
}
