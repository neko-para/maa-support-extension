import * as vscode from 'vscode'

import ver from '../../../maa/maaver.json'

export type * as Maa from '@maaxyz/maa-node'

export let maa: typeof import('@maaxyz/maa-node')

export function setupMaa() {
  maa = vscode.extensions.getExtension('nekosu.maa-node')?.exports
  if (!maa) {
    vscode.window.showErrorMessage(`Acquire MaaFramework failed.`)
    return false
  }
  if (maa.Global.version !== ver.version) {
    vscode.window.showErrorMessage(
      `MaaFramework version mismatch. Expect ${ver.version}, but ${maa.Global.version} provided.`
    )
    // return false
  }
  return true
}
