import * as fs from 'fs/promises'

import { MaaVersionManager } from '@mse/maa-version-manager'
import { type InterfaceBundle, joinPath } from '@mse/pipeline-manager'

import type { ProgramOption } from './option'

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  if (buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength) {
    return buffer.buffer as ArrayBuffer
  } else {
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer
  }
}

const emptyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=',
  'base64'
)
const image = toArrayBuffer(emptyPng)

type RecoJob = {
  node: string
  image: ArrayBuffer
  imageIndex: number
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

  module.paths.unshift(versionManager.moduleFolder(option.maaVersion))
  require('@maaxyz/maa-node')

  await bundle.switchActive(option.controller, option.resource)

  const ctrl = new maa.CustomController({
    connect() {
      return true
    },
    request_uuid() {
      return '0'
    },
    screencap() {
      return image
    }
  })
  await ctrl.post_connection().wait()
  const res = new maa.Resource()
  for (const folder of bundle.paths) {
    const full = joinPath(bundle.root, folder)
    await res.post_bundle(full).wait()
  }
  const inst = new maa.Tasker()
  inst.resource = res
  inst.controller = ctrl

  const result: {
    image: number
    node: string
    hit: boolean
  }[] = []

  const jobs: RecoJob[] = []

  for (const [imageIndex, imagePath] of option.images.entries()) {
    const image = toArrayBuffer(await fs.readFile(imagePath))
    for (const node of option.nodes) {
      jobs.push({
        node,
        image,
        imageIndex
      })
    }
  }

  let jobFinished = 0
  let jobCount = jobs.length

  res.register_custom_action('@mse/action', async self => {
    const performJob = async (job: RecoJob) => {
      const detail = await self.context.run_recognition(job.node, job.image)
      result.push({
        image: job.imageIndex,
        node: job.node,
        hit: !!detail?.hit
      })
    }

    const thread = async () => {
      while (jobs.length > 0) {
        const job = jobs.shift()!
        await performJob(job)
        jobFinished += 1
        if (!option.rawMode) {
          process.stdout.write(`${jobFinished} / ${jobCount}\r`)
        }
      }
    }

    await Promise.all(Array.from({ length: option.job }, () => thread()))

    return true
  })

  await inst
    .post_task('@mse/action', {
      '@mse/action': {
        action: 'Custom',
        custom_action: '@mse/action'
      }
    })
    .wait()

  inst.destroy()
  res.destroy()
  ctrl.destroy()

  if (option.rawMode) {
    console.log(JSON.stringify(result))
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

      console.log('')
    }
  }

  return true
}
