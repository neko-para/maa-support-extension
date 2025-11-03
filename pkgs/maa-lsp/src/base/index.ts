import { BaseService } from './base'
import { DocumentService } from './document'
import { GlobalStateService, LocalStateService } from './state'

export let globalStateService: GlobalStateService
export let localStateService: LocalStateService
export let documentService: DocumentService

export let services: BaseService[] = []

export async function setupBase() {
  globalStateService = new GlobalStateService()
  localStateService = new LocalStateService()
  documentService = new DocumentService()

  services = [globalStateService, localStateService, documentService]

  for (const service of services) {
    await service.init()
  }
}
