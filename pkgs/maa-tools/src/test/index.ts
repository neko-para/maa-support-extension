import { info as coreInfo } from '@actions/core'
import chalk from 'chalk'
import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as workerpool from 'workerpool'

import { joinPath } from '@nekosu/maa-pipeline-manager'

import type { FullConfig } from '../types/config'
import { loadBundle } from '../utils/bundle'
import { setupMaa } from '../utils/maa'
import type { GroupRecoResult, RecoJob, RecoResult } from './types'
import { checkRect } from './utils'

function splitChunk<T>(arr: T[], size: number) {
  const result: T[][] = []
  let curr = 0
  while (curr < arr.length) {
    const next = curr + size
    result.push(arr.slice(curr, next))
    curr = next
  }
  return result
}

export async function runTest(cfg: FullConfig) {
  if (!cfg.test) {
    return false
  }

  const modulePath = await setupMaa(cfg)
  if (!modulePath) {
    return false
  }

  const putLog = (log: string) => {
    if (cfg.mode === 'github') {
      coreInfo(log)
    } else {
      console.log(log)
    }
  }

  const result: GroupRecoResult[] = []

  const bundle = await loadBundle(path.resolve(cfg.cwd ?? process.cwd(), cfg.test.interfacePath))
  if (!bundle) {
    return false
  }

  let finished = 0

  let allTestCases = cfg.test.cases
  if (typeof allTestCases === 'function') {
    allTestCases = await allTestCases()
  }

  allTestCases.sort((a, b) => {
    return (
      a.configs.controller.localeCompare(b.configs.controller) * 2 +
      a.configs.resource.localeCompare(b.configs.resource)
    )
  })

  const taskCount = allTestCases
    .map(testCase => {
      const imageCount = testCase.cases.length
      const nodeCount = new Set(
        testCase.cases
          .map(c => c.hits.map(hit => (typeof hit === 'string' ? hit : hit.node)))
          .flat()
      ).size
      return imageCount * nodeCount
    })
    .reduce((a, b) => a + b, 0)

  const maxNodePerJob = cfg.test.maxNodePerJob ?? 50

  let poolCache: workerpool.Pool | null = null
  let poolHashKey: string = ''

  for (const testCases of allTestCases) {
    const name =
      testCases.configs.name ?? `${testCases.configs.controller}:${testCases.configs.resource}`

    const allImages = testCases.cases
      .map(c => ({
        image:
          path.resolve(
            cfg.cwd ?? process.cwd(),
            cfg.test!.casesCwd ?? '.',
            testCases.configs.imageRoot ?? '.',
            c.image
          ) + '.png',
        imageRaw: c.image
      }))
      .filter(({ image, imageRaw }) => {
        if (!existsSync(image)) {
          console.log(`${name} ${imageRaw} not exists, ignored`)
          return false
        } else {
          return true
        }
      })
    const allNodes = [
      ...new Set(
        testCases.cases
          .map(c => c.hits.map(hit => (typeof hit === 'string' ? hit : hit.node)).flat())
          .flat()
      )
    ]

    await bundle.switchActive(testCases.configs.controller, testCases.configs.resource)
    const resourcePaths = bundle.paths.map(folder => joinPath(bundle.root, folder))

    const newHashKey = `${testCases.configs.controller}:${testCases.configs.resource}`
    if (newHashKey !== poolHashKey) {
      await poolCache?.terminate()
      if (poolCache) {
        console.log('pool cache mismatched, dropped')
      }
      poolCache = null
    }

    if (!poolCache) {
      poolCache = workerpool.pool(path.join(import.meta.dirname, 'test', 'worker.mjs'), {
        maxWorkers: cfg.test.job ?? os.cpus().length / 4,
        workerType: 'process',
        forkOpts: {
          env: {
            MAAFW_MODULE_PATH: modulePath,
            MAAFW_STDOUT_LEVEL: cfg.mode === 'json' ? 'Off' : cfg.maaStdoutLevel,
            MAAFW_RESOURCE_PATHS: resourcePaths.join(path.delimiter)
          }
        }
      })
      poolHashKey = newHashKey
      console.log('pool created, hashkey', poolHashKey)
    }

    const tasks: Promise<void>[] = []
    const scheduleJob = (job: RecoJob, result: RecoResult[]) => {
      const task = poolCache!
        .exec<(job: RecoJob) => RecoResult[]>('performReco', [job])
        .then(res => res)
        .catch(err => {
          console.log(err)
          return []
        })
        .then(res => {
          finished += res.length
          result.push(...res)
          process.stderr.write(
            `${((finished * 100) / taskCount).toFixed(2)}% ${finished} / ${taskCount}\r`
          )
        })
      tasks.push(task)
    }

    const groupResult: GroupRecoResult = {
      cases: testCases,
      result: []
    }
    result.push(groupResult)
    for (const { image, imageRaw } of allImages) {
      const nodesChunks = splitChunk(allNodes, maxNodePerJob)
      for (const nodes of nodesChunks) {
        scheduleJob(
          {
            nodes,
            imagePath: image,
            imagePathRaw: imageRaw
          },
          groupResult.result
        )
      }
    }

    await Promise.all(tasks)
  }

  await poolCache?.terminate()

  let failed = false
  const errorDetails: RecoResult[] = []
  for (const group of result) {
    const groupName =
      group.cases.configs.name ??
      `${group.cases.configs.controller}:${group.cases.configs.resource}`

    let printed = false
    const putError = (err: string) => {
      if (!printed) {
        putLog(chalk.red(groupName))
        printed = true
      }
      putLog(err)
      failed = true
    }

    for (const testCase of group.cases.cases) {
      for (const res of group.result.filter(res => res.imagePathRaw === testCase.image)) {
        const hitCfg = testCase.hits.find(hit => {
          if (typeof hit === 'string') {
            return hit === res.node
          } else {
            return hit.node === res.node
          }
        })
        if (hitCfg) {
          if (!res.hit) {
            putError(`  ${testCase.image} ${res.node} should hit but missed`)
            errorDetails.push(res)
          } else if (typeof hitCfg !== 'string') {
            if (!res.detail) {
              putError(`  ${testCase.image} ${res.node} missing detail.`)
              errorDetails.push(res)
            } else if (!checkRect(hitCfg.box, res.detail!.box)) {
              putError(
                `  ${testCase.image} ${res.node} box mismatch. Expect ${JSON.stringify(hitCfg.box)}, hit ${JSON.stringify(res.detail.box)}`
              )
              errorDetails.push(res)
            }
          }
        } else {
          if (res.hit) {
            putError(`  ${testCase.image} ${res.node} should missed but hit`)
            errorDetails.push(res)
          }
        }
      }
    }

    if (!printed) {
      putLog(chalk.green(groupName))
    }
  }

  if (errorDetails.length > 0) {
    const file = path.resolve(
      cfg.cwd ?? process.cwd(),
      cfg.test.errorDetailsPath ?? 'maatoolsErrorDetails.json'
    )
    await fs.writeFile(file, JSON.stringify(errorDetails, null, 2))
  }

  return !failed
}
