import { BaseServiceBase } from './base'
import { DocumentService } from './document'
import { InterfaceService } from './interface'
import { LspService } from './lsp'
import { NativeService } from './native'
import { RootService } from './root'
import { ControlViewStateService, GlobalStateService, LocalStateService } from './state'

export let globalStateService: GlobalStateService
export let localStateService: LocalStateService
export let nativeService: NativeService

export let lspService: LspService
export let documentService: DocumentService

export let rootService: RootService
export let interfaceService: InterfaceService

export let controlViewStateService: ControlViewStateService

export let services: BaseServiceBase[] = []

export async function setupBase() {
  globalStateService = new GlobalStateService()
  localStateService = new LocalStateService()
  nativeService = new NativeService()

  lspService = new LspService()
  documentService = new DocumentService()

  rootService = new RootService()
  interfaceService = new InterfaceService()

  controlViewStateService = new ControlViewStateService()

  services = [
    globalStateService,
    localStateService,
    nativeService,
    lspService,
    documentService,
    rootService,
    interfaceService,
    controlViewStateService
  ]

  for (const service of services) {
    await service.init()
  }
}
