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

export class VscodeContentLoader implements IContentLoader {
  vscode: typeof import('vscode')

  constructor(vscode: typeof import('vscode')) {
    this.vscode = vscode
  }

  async get(file: string) {
    try {
      const doc = await this.vscode.workspace.openTextDocument(file)
      return doc.getText()
    } catch {
      return null
    }
  }
}
