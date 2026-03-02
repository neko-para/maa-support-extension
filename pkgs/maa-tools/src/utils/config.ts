import { createJiti } from 'jiti'
import * as path from 'node:path'

import type { FullConfig } from '../types/config'

export async function loadConfig(file: string) {
  try {
    const jiti = createJiti(import.meta.url)
    return (await jiti.import(path.resolve(process.cwd(), file), { default: true })) as FullConfig
  } catch (_err) {
    console.log(_err)
    return null
  }
}
