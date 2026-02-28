import { createJiti } from 'jiti/static'

import type { FullConfig } from '../types/config'

export async function loadConfig(file: string) {
  const jiti = createJiti(import.meta.url)
  return (await jiti.import(file, { default: true })) as FullConfig
}
