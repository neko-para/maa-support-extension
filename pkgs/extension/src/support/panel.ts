import * as vscode from 'vscode'

import { LaunchHostToWeb, LaunchWebToHost } from '@mse/types'
import { WebviewPanelProvider } from '@mse/utils'

import { isLaunchDev } from '../service/webview/dev'
import { request } from './utils'

export class WebviewPanel extends WebviewPanelProvider<LaunchHostToWeb, LaunchWebToHost> {
  pageId: string

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

    this.pageId = id
  }

  dispose() {
    request('/page/close', {
      pageId: this.pageId
    })
  }
}
