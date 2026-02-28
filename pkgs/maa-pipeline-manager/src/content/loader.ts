import * as fs from 'node:fs/promises'

export interface IContentLoader {
  get(file: string): Promise<string | null>
}

export class FsContentLoader implements IContentLoader {
  async get(file: string) {
    try {
      return await fs.readFile(file, 'utf8')
    } catch {
      return null
    }
  }
}
