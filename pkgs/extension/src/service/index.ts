import * as vscode from 'vscode'

import { AgentService } from './agent'
import { CommandService } from './command'
import { init as initContext } from './context'
import { DebugService } from './debug'
import { DiagnosticService } from './diagnostic'
import { InterfaceService } from './interface'
import { InterfaceLanguageProvider } from './language/interface/base'
import { InterfaceCodeLensProvider } from './language/interface/codeLens'
import { InterfaceCompletionProvider } from './language/interface/completion'
import { InterfaceDefinitionProvider } from './language/interface/definition'
import { InterfaceDocumentLinkProvider } from './language/interface/documentLink'
import { InterfaceHoverProvider } from './language/interface/hover'
import { InterfaceReferenceProvider } from './language/interface/reference'
import { PipelineLanguageProvider } from './language/pipeline/base'
import { PipelineCodeActionsProvider } from './language/pipeline/codeActions'
import { PipelineCodeLensProvider } from './language/pipeline/codeLens'
import { PipelineDocumentColorProvider } from './language/pipeline/color'
import { PipelineCompletionProvider } from './language/pipeline/completion'
import { PipelineDefinitionProvider } from './language/pipeline/definition'
import { PipelineDocumentLinkProvider } from './language/pipeline/documentLink'
import { PipelineHoverProvider } from './language/pipeline/hover'
import { PipelineInlayHintsProvider } from './language/pipeline/inlayHint'
import { PipelineReferenceProvider } from './language/pipeline/reference'
import { PipelineWorkspaceSymbolProvider } from './language/pipeline/workspaceSymbol'
import { LaunchService } from './launch'
import { NativeService } from './native'
import { type ServiceRegistry, registerServices } from './registry'
import { RootService } from './root'
import { ServerService } from './server'
import { ShortcutService } from './shortcut'
import { StateService } from './state'
import { StatusBarService } from './statusBar'
import { WebviewControlService } from './webview/control'

export { context } from './context'
export {
  agentService,
  commandService,
  debugService,
  diagnosticService,
  interfaceService,
  launchService,
  nativeService,
  rootService,
  serverService,
  shortcutService,
  stateService,
  statusBarService
} from './registry'

export let pipelineLanguageServices: PipelineLanguageProvider[]
export let interfaceLanguageServices: InterfaceLanguageProvider[]

export let webviewControlService: WebviewControlService

export async function init(ctx: vscode.ExtensionContext) {
  initContext(ctx)

  const publish = <K extends keyof ServiceRegistry>(name: K, service: ServiceRegistry[K]) => {
    registerServices({ [name]: service })
    return service
  }

  const services = {
    stateService: publish('stateService', new StateService()),
    nativeService: publish('nativeService', new NativeService()),
    statusBarService: publish('statusBarService', new StatusBarService()),
    serverService: publish('serverService', new ServerService()),
    shortcutService: publish('shortcutService', new ShortcutService()),
    rootService: publish('rootService', new RootService()),
    diagnosticService: publish('diagnosticService', new DiagnosticService()),
    interfaceService: publish('interfaceService', new InterfaceService()),
    launchService: publish('launchService', new LaunchService()),
    debugService: publish('debugService', new DebugService()),
    commandService: publish('commandService', new CommandService()),
    agentService: publish('agentService', new AgentService())
  } satisfies ServiceRegistry

  pipelineLanguageServices = [
    new PipelineCodeLensProvider(),
    new PipelineCompletionProvider(),
    new PipelineDefinitionProvider(),
    new PipelineDocumentLinkProvider(),
    new PipelineHoverProvider(),
    new PipelineReferenceProvider(),
    new PipelineWorkspaceSymbolProvider(),
    new PipelineInlayHintsProvider(),
    new PipelineCodeActionsProvider(),
    new PipelineDocumentColorProvider()
  ]

  interfaceLanguageServices = [
    new InterfaceCodeLensProvider(),
    new InterfaceCompletionProvider(),
    new InterfaceDefinitionProvider(),
    new InterfaceDocumentLinkProvider(),
    new InterfaceHoverProvider(),
    new InterfaceReferenceProvider()
  ]

  webviewControlService = new WebviewControlService()

  await services.stateService.init()
  await services.nativeService.init()
  await services.serverService.init()
  await services.shortcutService.init()
  await services.rootService.init()
  await services.interfaceService.init()
  await services.launchService.init()
  await services.debugService.init()
  await services.commandService.init()
  await services.diagnosticService.init()
  await services.statusBarService.init()
  await services.agentService.init()

  for (const service of pipelineLanguageServices) {
    await service.init()
  }

  for (const service of interfaceLanguageServices) {
    await service.init()
  }

  await webviewControlService.init()
}
