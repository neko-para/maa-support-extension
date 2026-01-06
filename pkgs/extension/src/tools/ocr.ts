import * as crypto from 'crypto'
import { existsSync } from 'fs'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

import { logger } from '@mse/utils'

import { isMaaAssistantArknights } from '../utils/fs'
import { setupFixedController } from './utils'

async function setupFakeResource(resources: string[]) {
  const temp = path.join(os.tmpdir(), 'maavsc-models')
  logger.info(`create fake resource under ${temp}`)

  const realPaths: string[] = []
  for (const res of resources) {
    const hasher = crypto.createHash('sha256')
    hasher.update(res)
    const key = hasher.digest('hex').slice(0, 6)
    const target = path.join(temp, key)
    realPaths.push(target)

    if (existsSync(target)) {
      logger.info(`${target} exists, skip copy`)
      continue
    }

    logger.info(`copy model from ${res} to ${target}`)

    const ppocrPath = path.join(res, 'PaddleOCR')
    const detPath = path.join(ppocrPath, 'det')
    const recPath = path.join(ppocrPath, 'rec')
    if (existsSync(ppocrPath)) {
      const targetOcrPath = path.join(target, 'model', 'ocr')
      await fs.mkdir(targetOcrPath, { recursive: true })
      if (existsSync(detPath)) {
        logger.debug('copy det')
        await fs.copyFile(
          path.join(detPath, 'inference.onnx'),
          path.join(targetOcrPath, 'det.onnx')
        )
      }
      if (existsSync(recPath)) {
        logger.debug('copy rec')
        await fs.copyFile(
          path.join(recPath, 'inference.onnx'),
          path.join(targetOcrPath, 'rec.onnx')
        )
        await fs.copyFile(path.join(recPath, 'keys.txt'), path.join(targetOcrPath, 'keys.txt'))
      }
    }
  }

  return realPaths
}

export async function performOcr(
  image: ArrayBuffer,
  roi: maa.Rect,
  resources: string[]
): Promise<string | null> {
  if (isMaaAssistantArknights) {
    try {
      resources = await setupFakeResource(resources)
    } catch (e) {
      logger.error(`setup fake resource failed ${e}`)
      return null
    }
  }

  const ctrl = await setupFixedController(image)

  if (!ctrl) {
    logger.error('ocr ctrl create failed')
    return null
  }

  const res = new maa.Resource()
  for (const resource of resources) {
    await res.post_bundle(resource).wait()
  }
  if (!res.loaded) {
    logger.error('ocr res create failed')
    return null
  }

  const tasker = new maa.Tasker()
  tasker.controller = ctrl
  tasker.resource = res
  if (!tasker.inited) {
    logger.error('ocr tasker create failed')
    return null
  }

  let result: string | null = null

  res.register_custom_action('@mse/action', async self => {
    logger.info('ocr action called')
    const resp = await self.context.run_recognition('@mse/ocr', image, {
      '@mse/ocr': {
        recognition: 'OCR',
        roi
      }
    })
    logger.info(`ocr reco done, resp ${JSON.stringify(resp)}`)
    if (resp) {
      const presp = {
        ...resp
      } as Partial<typeof resp>
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

  logger.info('ocr destroy')

  tasker.destroy()
  res.destroy()
  ctrl.destroy()

  return result
}

// performOcr(
//   readFileSync('image.png').buffer,
//   [0, 0, 100, 100],
//   'E:\\Projects\\MAA\\MAA1999\\assets\\resource\\base'
// ).then(result => console.log(JSON.parse(result ?? '{}')))
