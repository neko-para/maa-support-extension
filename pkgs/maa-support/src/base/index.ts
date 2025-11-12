import { BaseServiceBase } from './base'
import { DocumentService } from './document'
import { InterfaceService } from './interface'
import { LspService } from './lsp'
import { NativeService } from './native'
import { RootService } from './root'
import { GlobalStateService, LocalStateService } from './state'
import { VscodeService } from './vscode'
import { ControlViewStateService } from './webview/control'

export let globalStateService: GlobalStateService
export let localStateService: LocalStateService
export let nativeService: NativeService

export let vscodeService: VscodeService
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

  vscodeService = new VscodeService()
  lspService = new LspService()
  documentService = new DocumentService()

  rootService = new RootService()
  interfaceService = new InterfaceService()

  controlViewStateService = new ControlViewStateService()

  services = [
    globalStateService,
    localStateService,
    nativeService,
    vscodeService,
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
