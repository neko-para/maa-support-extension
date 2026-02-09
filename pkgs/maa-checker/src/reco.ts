import * as fs from 'fs/promises'
import path from 'path'
import * as workerpool from 'workerpool'

import { MaaVersionManager } from '@mse/maa-version-manager'
import { type InterfaceBundle, joinPath } from '@mse/pipeline-manager'

import type { ProgramOption } from './option'
import type { RecoJob, RecoResult } from './recoTypes'
import { gzCompress } from './utils'

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

export async function performReco(option: ProgramOption, bundle: InterfaceBundle<unknown>) {
  const versionManager = new MaaVersionManager(option.maaCache)
  await versionManager.init()
  if (
    !(await versionManager.prepare(option.maaVersion, msg => {
      if (!option.rawMode) {
        if (msg === 'prepare-folder') {
          console.log('preparing maafw')
        }
        console.log('    ' + msg)
      }
    }))
  ) {
    return false
  }

  const modulePath = versionManager.moduleFolder(option.maaVersion)
  const pool = workerpool.pool(path.join(__dirname, 'recoWorker.js'), {
    maxWorkers: option.job,
    workerType: 'process',
    forkOpts: {
      env: {
        MAAFW_MODULE_PATH: modulePath,
        MAAFW_SILENCE_STDOUT: option.rawMode ? '1' : ''
      }
    }
  })

  await bundle.switchActive(option.controller, option.resource)
  const resourcePaths = bundle.paths.map(folder => joinPath(bundle.root, folder))

  const jobs: RecoJob[] = []
  const result: RecoResult[] = []

  let finished = 0
  const taskCount = option.images.length * option.nodes.length

  const autoMaxNodePerJob = Math.ceil(option.nodes.length / option.job)
  const maxNodePerJob = option.maxNodePerJob === 0 ? autoMaxNodePerJob : option.maxNodePerJob

  for (const [imageIndex, imagePath] of option.images.entries()) {
    const image = (await fs.readFile(imagePath)).toString('base64')
    const nodesChunks = splitChunk(option.nodes, maxNodePerJob)
    for (const nodes of nodesChunks) {
      jobs.push({
        nodes,
        image,
        imageIndex,
        imagePath
      })
    }
  }

  const tasks: Promise<void>[] = []
  for (const job of jobs) {
    const task = pool
      .exec<(job: RecoJob, paths: string[]) => RecoResult[]>('performReco', [job, resourcePaths])
      .then(res => res)
      .catch(err => {
        console.log(err)
        return []
      })
      .then(res => {
        finished += res.length
        result.push(...res)
        if (!option.rawMode) {
          process.stdout.write(`${finished} / ${taskCount}\r`)
        }
      })
    tasks.push(task)
  }

  await Promise.all(tasks)

  if (option.rawMode) {
    let data = JSON.stringify(result)
    if (option.gz) {
      data = gzCompress(data)
    }
    console.log(data)
  } else {
    for (const node of option.nodes) {
      const sub = result.filter(info => info.node === node)
      const hits = sub.filter(info => info.hit)
      const misses = sub.filter(info => !info.hit)

      console.log(`${node}: ${hits.length} / ${sub.length}`)

      if (hits.length > 0 && option.printHit) {
        console.log(`hit images:`)
        for (const info of hits) {
          console.log(`    ${option.imagesRaw[info.image]}`)
        }
      }
      if (misses.length > 0 && option.printNotHit) {
        console.log(`missed images:`)
        for (const info of misses) {
          console.log(`    ${option.imagesRaw[info.image]}`)
        }
      }
    }
  }

  await pool.terminate()

  return true
}
