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

  const result: GroupRecoResult[] = []

  const bundle = await loadBundle(path.resolve(cfg.cwd ?? process.cwd(), cfg.test.interfacePath))
  if (!bundle) {
    return false
  }

  let finished = 0

  const taskCount = cfg.test.cases.map(testCase => {
    const imageCount = testCase.cases.length
    const nodeCount = testCase.cases.map(c => c.hits.length).reduce((a, b) => a + b, 0)
    return imageCount * nodeCount
  })

  const maxNodePerJob = cfg.test.maxNodePerJob ?? 50

  for (const testCases of cfg.test.cases) {
    const allImages = testCases.cases.map(c => ({
      image:
        path.resolve(
          cfg.cwd ?? process.cwd(),
          cfg.test!.casesCwd ?? '.',
          testCases.configs.imageRoot ?? '.',
          c.image
        ) + '.png',
      imageRaw: c.image
    }))
    const allNodes = [
      ...new Set(
        testCases.cases
          .map(c => c.hits.map(hit => (typeof hit === 'string' ? hit : hit.node)).flat())
          .flat()
      )
    ]

    await bundle.switchActive(testCases.configs.controller, testCases.configs.resource)
    const resourcePaths = bundle.paths.map(folder => joinPath(bundle.root, folder))

    const pool = workerpool.pool(path.join(import.meta.dirname, 'test', 'worker.mjs'), {
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

    const tasks: Promise<void>[] = []
    const scheduleJob = (job: RecoJob, result: RecoResult[]) => {
      const task = pool
        .exec<(job: RecoJob) => RecoResult[]>('performReco', [job])
        .then(res => res)
        .catch(err => {
          console.log(err)
          return []
        })
        .then(res => {
          finished += res.length
          result.push(...res)
          process.stderr.write(`${finished} / ${taskCount}\r`)
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
    await pool.terminate()
  }

  for (const group of result) {
    const groupName =
      group.cases.configs.name ??
      `${group.cases.configs.controller}:${group.cases.configs.resource}`

    console.log(`${groupName}`)
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
            console.log(`  ${testCase.image} ${res.node} should hit but missed`)
          } else if (typeof hitCfg !== 'string') {
            if (!res.detail) {
              console.log(`  ${testCase.image} ${res.node} missing detail.`)
            } else if (!checkRect(hitCfg.box, res.detail!.box)) {
              console.log(
                `  ${testCase.image} ${res.node} box mismatch. Expect ${JSON.stringify(hitCfg.box)}, hit ${JSON.stringify(res.detail.box)}`
              )
            }
          }
        } else {
          if (res.hit) {
            console.log(`  ${testCase.image} ${res.node} should missed but hit`)
          }
        }
      }
    }
  }
  return true
}
