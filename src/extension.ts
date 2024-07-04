import * as maa from '@nekosu/maa-node'
import sms from 'source-map-support'
import * as vscode from 'vscode'

import { resetInstance, sharedInstance } from './data'
import { PipelineDefinitionProvider } from './pipeline/definition'
import { PipelineRootStatusProvider } from './pipeline/root'
import { PipelineTaskIndexProvider } from './pipeline/task'

sms.install()

export function activate(context: vscode.ExtensionContext) {
  console.log(maa.version())

  sharedInstance(context, PipelineRootStatusProvider)
  sharedInstance(context, PipelineTaskIndexProvider)
  sharedInstance(context, PipelineDefinitionProvider)
}

export function deactivate() {
  resetInstance()
}
