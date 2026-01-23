import * as vscode from 'vscode'

import { t } from '@mse/utils'

import packageJson from '../../../../release/package.json'
import { commands } from '../command'
import { BaseService } from './context'

export class StatusBarService extends BaseService {
  extItem: vscode.StatusBarItem
  maaItem?: vscode.StatusBarItem
  transportItem: vscode.StatusBarItem

  constructor() {
    super()
    console.log('construct StatusBarService')

    this.extItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
    this.extItem.command = commands.RevealControlPanel
    this.extItem.text = `MaaSupport ${packageJson.version}`
    this.extItem.show()

    this.transportItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
    this.transportItem.show()

    this.defer = vscode.commands.registerCommand(commands.RevealControlPanel, () => {
      vscode.commands.executeCommand('maa.view.control-panel.focus')
    })
  }

  async init() {
    console.log('init StatusBarService')
  }

  showMaaStatus(version: string | null) {
    if (!this.maaItem) {
      this.maaItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
      this.maaItem.command = commands.NativeSelectMaa
    }
    this.maaItem.text = `MaaFramework ${version ?? t('maa.status.not-loaded')}`
    this.maaItem.show()
  }
}
