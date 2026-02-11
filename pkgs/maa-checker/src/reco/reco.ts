import * as path from 'path'
import * as workerpool from 'workerpool'

import { MaaVersionManager } from '@mse/maa-version-manager'
import { type InterfaceBundle, joinPath } from '@mse/pipeline-manager'

import type { ProgramOption } from '../option'
import { console2, getColorInfo, gzCompress } from '../utils'
import { performRecoTestImpl } from './recoTest'
import type { GroupRecoResult, RecoJob, RecoResult } from './types'

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
  console2.timeLog('checker', 'start reco')

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

  console2.timeLog('checker', 'maafw prepared')

  await bundle.switchActive(option.controller, option.resource)
  const resourcePaths = bundle.paths.map(folder => joinPath(bundle.root, folder))

  console2.timeLog('checker', 'resource switched')

  const modulePath = versionManager.moduleFolder(option.maaVersion)
  const pool = workerpool.pool(path.join(__dirname, 'reco', 'worker.js'), {
    maxWorkers: option.job,
    workerType: 'process',
    forkOpts: {
      env: {
        MAAFW_MODULE_PATH: modulePath,
        MAAFW_SILENCE_STDOUT: option.rawMode ? '1' : '',
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

  const result: GroupRecoResult[] = []

  let finished = 0
  const taskCount = option.groups
    .map(group => group.images.length * group.nodes.length)
    .reduce((a, b) => a + b, 0)

  const maxNodesCount = Math.max(...option.groups.map(group => group.nodes.length))
  const autoMaxNodePerJob = Math.max(50, Math.ceil(maxNodesCount / option.job))
  const maxNodePerJob = option.maxNodePerJob === 0 ? autoMaxNodePerJob : option.maxNodePerJob

  for (const group of option.groups) {
    const groupResult: GroupRecoResult = {
      group,
      result: []
    }
    for (const [imageIndex, imagePath] of group.images.entries()) {
      const nodesChunks = splitChunk(group.nodes, maxNodePerJob)
      for (const nodes of nodesChunks) {
        scheduleJob(
          {
            nodes,
            imagePath,
            imagePathRaw: group.imagesRaw[imageIndex]
          },
          groupResult.result
        )
      }
    }
    result.push(groupResult)
  }

  console2.timeLog('checker', 'job scheduled')

  await Promise.all(tasks)

  console2.timeLog('checker', 'job finished')

  if (option.pipeTest) {
    await performRecoTestImpl(option, result)
  } else if (option.rawMode) {
    let data = JSON.stringify(result)
    if (option.gz) {
      data = gzCompress(data)
    }
    console.log(data)
  } else {
    const { enableColor, hitPrefix, missPrefix, resetSuffix } = getColorInfo(option)

    for (const groupResult of result) {
      console.log(`Group: ${groupResult.group.name}`)
      for (const node of new Set(groupResult.group.nodes)) {
        const sub = groupResult.result.filter(info => info.node === node)
        const hits = sub.filter(info => info.hit)
        const misses = sub.filter(info => !info.hit)

        console.log(`  ${node}: ${hits.length} / ${sub.length}`)

        if (hits.length > 0 && option.printHit) {
          if (!enableColor) {
            console.log(`  hit images:`)
          }
          for (const info of hits) {
            console.log(`    ${hitPrefix}${info.imagePathRaw}${resetSuffix}`)
          }
        }
        if (misses.length > 0 && option.printNotHit) {
          if (!enableColor) {
            console.log(`  missed images:`)
          }
          for (const info of misses) {
            console.log(`    ${missPrefix}${info.imagePathRaw}${resetSuffix}`)
          }
        }
      }
    }
  }

  console2.timeLog('checker', 'output finished')

  await pool.terminate()

  console2.timeLog('checker', 'pool cleared')

  return true
}
