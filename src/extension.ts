import * as maa from '@nekosu/maa-node'
import * as vscode from 'vscode'

import { resetInstance, sharedInstance } from './data'
import { PipelineRootStatusProvider } from './pipeline/root'
import { PipelineTaskIndexProvider } from './pipeline/task'

export function activate(context: vscode.ExtensionContext) {
  console.log(maa.version())

  sharedInstance(context, PipelineRootStatusProvider)
  sharedInstance(context, PipelineTaskIndexProvider)
}

export function deactivate() {
  resetInstance()
}
