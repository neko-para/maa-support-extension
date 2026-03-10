import { createJiti } from 'jiti/static'
import { existsSync } from 'node:fs'

import { logger } from '@mse/utils'
import type { FullConfig } from '@nekosu/maa-tools'

export async function loadConfig(file: string) {
  if (!existsSync(file)) {
    logger.warn('no maatools.config.mts provided')
    return null
  }

  try {
    const jiti = createJiti(import.meta.url, {
      moduleCache: false
    })
    return (await jiti.import(file, { default: true })) as FullConfig
  } catch (err) {
    logger.error(`${err}`)
    return null
  }
}
