import { BaseService } from './base'
import { DocumentService } from './document'
import { NativeService } from './native'
import { GlobalStateService, LocalStateService } from './state'

export let globalStateService: GlobalStateService
export let localStateService: LocalStateService
export let nativeService: NativeService
export let documentService: DocumentService

export let services: BaseService[] = []

export async function setupBase() {
  globalStateService = new GlobalStateService()
  localStateService = new LocalStateService()
  nativeService = new NativeService()
  documentService = new DocumentService()

  services = [globalStateService, localStateService, nativeService, documentService]

  for (const service of services) {
    await service.init()
  }
}
