import * as fs from 'fs/promises'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { URI as Uri } from 'vscode-uri'

import { lsp } from '../lsp/connection'
import { BaseService } from './base'

export class DocumentService extends BaseService {
  async get(uri: Uri, lang: string = 'plaintext'): Promise<TextDocument | undefined> {
    if (lsp) {
      const doc = lsp.documents.get(uri.toString())
      if (doc) {
        return doc
      }
    }
    if (uri.scheme !== 'file') {
      return
    }
    try {
      const content = await fs.readFile(uri.fsPath, 'utf8')
      const doc = TextDocument.create(uri.toString(), lang, 1, content)
      return doc
    } catch {
      return
    }
  }
}
