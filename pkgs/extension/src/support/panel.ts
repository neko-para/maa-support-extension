import * as vscode from 'vscode'

import { LaunchHostToWeb, LaunchWebToHost } from '@mse/types'
import { WebviewPanelProvider } from '@mse/utils'

import { isLaunchDev } from '../service/webview/dev'

export class WebviewPanel extends WebviewPanelProvider<LaunchHostToWeb, LaunchWebToHost> {
  constructor(
    context: vscode.ExtensionContext,
    type: 'launch' | 'crop',
    id: string,
    title: string,
    viewColumn?: vscode.ViewColumn
  ) {
    super({
      context,
      folder: 'webview',
      index: type,
      webId: `maa.view.${type}`,
      title,
      viewColumn: viewColumn ?? vscode.ViewColumn.Active,
      preserveFocus: false,
      iconPath: 'images/logo.png',
      dev: isLaunchDev,

      id
    })
  }

  dispose() {}
}
