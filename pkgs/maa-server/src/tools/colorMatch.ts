import type { ToolResult } from '@nekosu/maa-server-proto'
import type { ColorMatchOptions } from '@nekosu/maa-types'

import { logger } from '../server'
import { normalizeColorMatchOptions } from './colorRange'
import { setupFakeResource } from './fakeResource'
import { convertImage, setupFixedController } from './utils'

/**
 * 对给定图像执行一次 ColorMatch 识别。
 *
 * 与 templateMatch / ocr 一样走 fake resource + Custom action：识别参数作为
 * pipeline_override 传给 run_recognition，识别详情去掉二进制字段后序列化返回。
 */
export async function performColorMatch(
  imageBase64: string,
  options: ColorMatchOptions
): Promise<ToolResult> {
  const normalized = normalizeColorMatchOptions(options)
  if (!normalized.ok) {
    logger.error(`color match options invalid: ${normalized.error}`)
    return {
      detail: null,
      failure: { kind: 'internal', tag: 'invalid-options', detail: normalized.error }
    }
  }
  const opts = normalized.value

  const image = convertImage(imageBase64)

  let ctrl: Awaited<ReturnType<typeof setupFixedController>> = null
  let res: maa.Resource | null = null
  let tasker: maa.Tasker | null = null

  try {
    ctrl = await setupFixedController(image)
    if (!ctrl) {
      logger.error('color match ctrl create failed')
      return { detail: null, failure: { kind: 'internal', tag: 'controller-create-failed' } }
    }

    const tempRes = await setupFakeResource()

    res = new maa.Resource()
    await res.post_bundle(tempRes).wait()
    if (!res.loaded) {
      logger.error('color match res create failed')
      return { detail: null, failure: { kind: 'internal', tag: 'resource-load-failed' } }
    }

    tasker = new maa.Tasker()
    tasker.controller = ctrl
    tasker.resource = res
    if (!tasker.inited) {
      logger.error('color match tasker create failed')
      return { detail: null, failure: { kind: 'internal', tag: 'tasker-create-failed' } }
    }

    let result: string | null = null

    res.register_custom_action('@mse/action', async self => {
      logger.info(`color match action called with options: ${JSON.stringify(opts)}`)
      const detail = await self.context.run_recognition('@mse/reco', image, {
        '@mse/reco': {
          recognition: 'ColorMatch',
          roi: opts.roi,
          method: opts.method,
          lower: opts.lower,
          upper: opts.upper,
          count: opts.count,
          connected: opts.connected
        }
      })

      if (!detail) {
        return true
      }

      const presp = {
        ...detail
      } as Partial<typeof detail>
      delete presp.draws
      delete presp.raw
      result = JSON.stringify(presp)

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

    logger.info('color match destroy')

    return { detail: result }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logger.error(`color match failed: ${message}`)
    return { detail: null, failure: { kind: 'internal', tag: 'internal-error', detail: message } }
  } finally {
    try {
      tasker?.destroy()
      res?.destroy()
    } catch (e) {
      logger.error(`color match cleanup failed: ${e}`)
    }

    const controller = ctrl
    if (controller) {
      setTimeout(() => {
        try {
          controller.destroy()
        } catch (e) {
          logger.error(`color match controller destroy failed: ${e}`)
        }
      }, 1000)
    }
  }
}
