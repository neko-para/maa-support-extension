import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

import { logger } from '../server'
import { convertImage, setupFixedController } from './utils'

async function setupFakeResource() {
  const temp = path.join(os.tmpdir(), 'maavsc-matches')
  logger.info(`create fake resource under ${temp}`)

  await fs.mkdir(path.join(temp, 'pipeline'), { recursive: true })
  await fs.writeFile(path.join(temp, 'pipeline', '1.json'), '{}')

  return temp
}

export async function performTemplateMatch(
  imageBase64: string,
  opts: {
    roi: maa.Rect
    method: 10001 | 3 | 5
    threshold: number
    green_mask: boolean
  }
) {
  const image = convertImage(imageBase64)

  const ctrl = await setupFixedController(image)

  if (!ctrl) {
    logger.error('tmpl match ctrl create failed')
    return null
  }

  const tempRes = await setupFakeResource()

  const res = new maa.Resource()
  await res.post_bundle(tempRes).wait()
  res.override_image('@mse_image', image)

  const tasker = new maa.Tasker()
  tasker.controller = ctrl
  tasker.resource = res

  if (!tasker.inited) {
    logger.error('tmpl match tasker create failed')
    tasker.destroy()
    res.destroy()
    ctrl.destroy()
    return null
  }

  let result: string | null = null

  res.register_custom_action('@mse/action', async self => {
    logger.info(`tmpl match action called with options: ${JSON.stringify(opts)}`)
    const detail = await self.context.run_recognition('@mse/reco', image, {
      '@mse/reco': {
        recognition: 'TemplateMatch',
        template: '@mse_image',
        ...opts
      } // satisfies maa.Task 暂时先不加这个, method对不上
    })

    if (detail?.hit) {
      const presp = {
        ...detail
      } as Partial<typeof detail>
      delete presp.draws
      delete presp.raw
      result = JSON.stringify(presp)
    }
    return true
  })

  await tasker
    .post_task('@mse/action', {
      '@mse/action': {
        action: 'Custom',
        custom_action: '@mse/action'
      }
    })
    .wait()

  logger.info('tmpl match destroy')

  tasker.destroy()
  res.destroy()
  ctrl.destroy()

  return result
}
