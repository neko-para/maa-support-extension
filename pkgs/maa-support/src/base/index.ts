import { BaseServiceBase } from './base'
import { DocumentService } from './document'
import { NativeService } from './native'
import { RootService } from './root'
import { ControlViewStateService, GlobalStateService, LocalStateService } from './state'

export let globalStateService: GlobalStateService
export let localStateService: LocalStateService
export let nativeService: NativeService
export let rootService: RootService

export let controlViewStateService: ControlViewStateService

export let documentService: DocumentService

export let services: BaseServiceBase[] = []

export async function setupBase() {
  globalStateService = new GlobalStateService()
  localStateService = new LocalStateService()
  nativeService = new NativeService()
  rootService = new RootService()

  controlViewStateService = new ControlViewStateService()

  documentService = new DocumentService()

  services = [
    globalStateService,
    localStateService,
    nativeService,
    rootService,
    controlViewStateService,
    documentService
  ]

  for (const service of services) {
    await service.init()
  }
}
