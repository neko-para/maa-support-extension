import * as os from 'node:os'
import * as path from 'node:path'
import * as workerpool from 'workerpool'

import {
  FsContentLoader,
  FsContentWatcher,
  InterfaceBundle,
  joinPath
} from '@nekosu/maa-pipeline-manager'
import { MaaVersionManager } from '@nekosu/maa-version-manager'

import pkg from '../../package.json'
import type { FullConfig } from '../types/config'
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

async function setupMaa(cfg: FullConfig) {
  const maaVersion = cfg.test!.maaVersion ?? pkg.devDependencies['@maaxyz/maa-node']

  const versionManager = new MaaVersionManager(
    cfg.test!.maaCache ?? path.join(os.homedir(), '.maa-checker')
  )
  await versionManager.init()
  if (
    !(await versionManager.prepare(maaVersion, msg => {
      if (cfg.mode !== 'json') {
        if (msg === 'prepare-folder') {
          console.log('preparing maafw')
        }
        console.log('    ' + msg)
      }
    }))
  ) {
    return null
  }
  return versionManager.moduleFolder(maaVersion)
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

  const bundle = new InterfaceBundle(
    new FsContentLoader(),
    new FsContentWatcher(),
    false,
    path.dirname(cfg.test.interfacePath),
    path.basename(cfg.test.interfacePath)
  )
  await bundle.load()
  await bundle.flush(false) // 刷下 imports

  let finished = 0

  const taskCount = cfg.test.cases.map(testCase => {
    const imageCount = testCase.cases.length
    const nodeCount = testCase.cases.map(c => c.hits.length).reduce((a, b) => a + b, 0)
    return imageCount * nodeCount
  })

  const maxNodePerJob = cfg.test.maxNodePerJob ?? 50

  for (const testCases of cfg.test.cases) {
    const allImages = testCases.cases.map(c => ({
      image: path.resolve(testCases.configs.imageRoot, c.image) + '.png',
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

    const pool = workerpool.pool(path.join(import.meta.dirname, 'reco', 'worker.mjs'), {
      maxWorkers: cfg.test.job ?? os.cpus().length / 4,
      workerType: 'process',
      forkOpts: {
        env: {
          MAAFW_MODULE_PATH: modulePath,
          MAAFW_SILENCE_STDOUT: cfg.mode === 'json' ? '1' : '',
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

    console.log(`${groupName}:`)
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
            if (!res.detail || !checkRect(hitCfg.box, res.detail!.box)) {
              console.log(`  ${testCase.image} ${res.node} box mismatch`)
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
