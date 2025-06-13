import * as vscode from 'vscode'

import { BaseService, init as initContext } from './context'
import { InterfaceService } from './interface'
import { InterfaceIndexService } from './interfaceIndex'
import { InterfaceLanguageProvider } from './language/interface/base'
import { InterfaceCodeLensProvider } from './language/interface/codeLens'
import { InterfaceCompletionProvider } from './language/interface/completion'
import { InterfaceDefinitionProvider } from './language/interface/definition'
import { InterfaceReferenceProvider } from './language/interface/reference'
import { PipelineLanguageProvider } from './language/pipeline/base'
import { PipelineCodeLensProvider } from './language/pipeline/codeLens'
import { PipelineCompletionProvider } from './language/pipeline/completion'
import { PipelineDefinitionProvider } from './language/pipeline/definition'
import { PipelineDocumentLinkProvider } from './language/pipeline/documentLink'
import { PipelineHoverProvider } from './language/pipeline/hover'
import { PipelineReferenceProvider } from './language/pipeline/reference'
import { LaunchService } from './launch'
import { RootService } from './root'
import { StateService } from './state'
import { TaskIndexService } from './taskIndex'

export { context } from './context'

export let stateService: StateService
export let rootService: RootService
export let interfaceService: InterfaceService
export let taskIndexService: TaskIndexService
export let interfaceIndexService: InterfaceIndexService
export let launchService: LaunchService

export let pipelineLanguageServices: PipelineLanguageProvider[]
export let interfaceLanguageServices: InterfaceLanguageProvider[]

export async function init(ctx: vscode.ExtensionContext) {
  initContext(ctx)

  stateService = new StateService()
  rootService = new RootService()
  interfaceService = new InterfaceService()
  taskIndexService = new TaskIndexService()
  interfaceIndexService = new InterfaceIndexService()
  launchService = new LaunchService()

  pipelineLanguageServices = [
    new PipelineCodeLensProvider(),
    new PipelineCompletionProvider(),
    new PipelineDefinitionProvider(),
    new PipelineDocumentLinkProvider(),
    new PipelineHoverProvider(),
    new PipelineReferenceProvider()
  ]

  interfaceLanguageServices = [
    new InterfaceCodeLensProvider(),
    new InterfaceCompletionProvider(),
    new InterfaceDefinitionProvider(),
    new InterfaceReferenceProvider()
  ]

  await stateService.init()
  await rootService.init()
  await interfaceService.init()
  await taskIndexService.init()
  await interfaceIndexService.init()
  await launchService.init()

  for (const service of pipelineLanguageServices) {
    await service.init()
  }

  for (const service of interfaceLanguageServices) {
    await service.init()
  }
}
