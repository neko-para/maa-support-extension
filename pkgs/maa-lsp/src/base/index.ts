import { DocumentProvider } from './document'

export let documentProvider: DocumentProvider

export function setupBase() {
  documentProvider = new DocumentProvider()
}
