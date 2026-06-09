import * as fs from 'node:fs/promises'

import type { IContentLoader } from '../types'

export class FsContentLoader implements IContentLoader {
  async get(file: string): Promise<string | null> {
    try {
      return await fs.readFile(file, 'utf8')
    } catch {
      return null
    }
  }

  async listFiles(dir: string): Promise<string[]> {
    try {
      return await fs.readdir(dir, { recursive: true })
    } catch {
      return []
    }
  }
}
