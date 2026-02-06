import * as fs from 'fs/promises'

import { MaaVersionManager } from '@mse/maa-version-manager'
import { type AbsolutePath, type InterfaceBundle, joinPath } from '@mse/pipeline-manager'

import type { ProgramOption } from './option'

export async function performReco(option: ProgramOption, bundle: InterfaceBundle<unknown>) {
  const versionManager = new MaaVersionManager(option.maaCache)
  await versionManager.init()
  if (
    !(await versionManager.prepare(option.maaVersion, msg => {
      if (!option.rawMode) {
        console.log(msg)
      }
    }))
  ) {
    return false
  }

  module.paths.unshift(versionManager.moduleFolder(option.maaVersion))
  require('@maaxyz/maa-node')

  await bundle.switchActive(option.controller, option.resource)

  const res = new maa.Resource()
  for (const folder of bundle.paths) {
    const full = joinPath(bundle.root, folder)
    await res.post_bundle(full).wait()
  }

  const result: {
    image: number
    node: string
    hit: boolean
  }[] = []

  for (const [imageIdx, imagePath] of option.images.entries()) {
    if (!option.rawMode) {
      console.log(
        `checking image ${imageIdx + 1} / ${option.images.length} ${option.imagesRaw[imageIdx]}`
      )
    }

    const image = await fs.readFile(imagePath)
    const ctrl = new maa.CustomController({
      connect() {
        return true
      },
      request_uuid() {
        return '0'
      },
      screencap() {
        return image.buffer
      }
    })
    await ctrl.post_connection().wait()

    const inst = new maa.Tasker()
    inst.resource = res
    inst.controller = ctrl

    res.register_custom_action('@mse/action', async self => {
      for (const [nodeIdx, node] of option.nodes.entries()) {
        if (!option.rawMode) {
          console.log(`    checking node ${nodeIdx + 1} / ${option.nodes.length} ${node}`)
        }
        const detail = await self.context.run_recognition(node, image.buffer)
        result.push({
          image: imageIdx,
          node,
          hit: !!detail?.hit
        })
      }

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

    res.unregister_custom_action('@mse/action')

    inst.destroy()
    ctrl.destroy()
  }

  res.destroy()

  if (option.rawMode) {
    console.log(JSON.stringify(result))
  } else {
    console.log('')

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
