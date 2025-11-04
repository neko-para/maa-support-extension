import { TextDocument } from 'vscode-languageserver-textdocument'
import {
  ProposedFeatures,
  Range,
  TextDocumentSyncKind,
  TextDocuments,
  createConnection,
  createServerSocketTransport
} from 'vscode-languageserver/node'

export class LspConnection {
  connection: ProposedFeatures.Connection
  documents: TextDocuments<TextDocument>

  constructor(port: number) {
    const [input, output] = createServerSocketTransport(port)
    this.connection = createConnection(ProposedFeatures.all, input, output)
    this.documents = new TextDocuments(TextDocument)

    this.connection.onInitialize(params => {
      return {
        capabilities: {
          textDocumentSync: TextDocumentSyncKind.Incremental,
          hoverProvider: {}
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

export function setupLsp(port: number) {
  lsp = new LspConnection(port)
}
