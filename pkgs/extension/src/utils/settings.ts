import * as vscode from 'vscode'

export function getTooltipDisabled(): boolean {
  return (
    (vscode.workspace.getConfiguration('maa').get('webviewTooltipDisabled') as
      | boolean
      | undefined) ?? false
  )
}
