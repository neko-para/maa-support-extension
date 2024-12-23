import { logger } from '@mse/utils'

import { Maa, maa } from '../maa'

export async function performOcr(
  image: ArrayBuffer,
  roi: Maa.api.FlatRect,
  resource: string
): Promise<string | null> {
  const ctrl = new maa.CustomController(
    new (class extends maa.CustomControllerActorDefaultImpl {
      connect() {
        return true
      }

      request_uuid() {
        return '0'
      }

      screencap() {
        return image
      }
    })()
  )
  await ctrl.post_connection().wait()
  if (!ctrl.connected) {
    logger.error('ocr ctrl create failed')
    return null
  }

  const res = new maa.Resource()
  await res.post_path(resource).wait()
  if (!res.loaded) {
    logger.error('ocr res create failed')
    return null
  }

  const tasker = new maa.Tasker()
  tasker.bind(ctrl)
  tasker.bind(res)
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
    .post_pipeline('@mse/action', {
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
