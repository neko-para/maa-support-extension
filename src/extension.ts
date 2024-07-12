import * as maa from '@nekosu/maa-node'
import sms from 'source-map-support'
import * as vscode from 'vscode'

import { loadServices, resetInstance } from './data'
import { PipelineCompletionProvider } from './pipeline/completion'
import { PipelineDefinitionProvider } from './pipeline/definition'
import { PipelineHoverProvider } from './pipeline/hover'
import { PipelineReferenceProvider } from './pipeline/reference'
import { PipelineRootStatusProvider } from './pipeline/root'
import { PipelineTaskIndexProvider } from './pipeline/task'

sms.install()

export function activate(context: vscode.ExtensionContext) {
  console.log(maa.version())

  loadServices(context, [
    PipelineRootStatusProvider,
    PipelineTaskIndexProvider,
    PipelineDefinitionProvider,
    PipelineCompletionProvider,
    PipelineReferenceProvider,
    PipelineHoverProvider
  ])
}

export function deactivate() {
  resetInstance()
}
