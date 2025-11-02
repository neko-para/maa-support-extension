import { TextDocument } from 'vscode-languageserver-textdocument'
import {
  ProposedFeatures,
  Range,
  TextDocumentSyncKind,
  TextDocuments,
  createConnection
} from 'vscode-languageserver/node'

export class LspConnection {
  connection: ProposedFeatures.Connection
  documents: TextDocuments<TextDocument>

  constructor() {
    this.connection = createConnection(ProposedFeatures.all)
    this.documents = new TextDocuments(TextDocument)

    this.connection.onInitialize(params => {
      return {
        capabilities: {
          textDocumentSync: TextDocumentSyncKind.Incremental,
          documentLinkProvider: {}
        }
      }
    })

    this.connection.onHover(params => {
      const doc = this.documents.get(params.textDocument.uri)
      if (!doc) {
        return
      }
      const pos = params.position
      const offset = doc.offsetAt(pos)
      const text = doc.getText(Range.create(doc.positionAt(offset - 5), doc.positionAt(offset + 5)))
      return {
        contents: `hover content for ${text}!`
      }
    })

    this.documents.listen(this.connection)
    this.connection.listen()
  }
}

export let lsp: LspConnection | null = null

export function setupLsp() {
  lsp = new LspConnection()
}
