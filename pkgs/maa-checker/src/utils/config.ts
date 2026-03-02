import { createJiti } from 'jiti'

import type { FullConfig } from '../types/config'

export async function loadConfig(file: string) {
  try {
    const jiti = createJiti(import.meta.url)
    return (await jiti.import(file, { default: true })) as FullConfig
  } catch (_err) {
    return null
  }
}
