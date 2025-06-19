import semverCompare from 'semver/functions/compare'
import * as vscode from 'vscode'

import ver from '../../../maa/maaver.json'

export type * as Maa from '@maaxyz/maa-node'

export let maa: typeof import('@maaxyz/maa-node')

export async function setupMaa() {
  maa = vscode.extensions.getExtension('nekosu.maa-node')?.exports
  if (!maa) {
    vscode.window.showErrorMessage(`Acquire MaaFramework failed.`)
    return false
  }
  const res = semverCompare(maa.Global.version, ver.version)
  switch (res) {
    case 0:
      return true
    case 1: // 比预期更高
      vscode.window.showInformationMessage(
        `MaaFramework 版本不同. 预期 ${ver.version}, 当前 ${maa.Global.version}.`
      )
      return true
    case -1: // 比预期更低
      vscode.window.showInformationMessage(
        `MaaFramework 版本不同. 预期 ${ver.version}, 当前 ${maa.Global.version}. 当前版本较低, 功能可能出现问题.`
      )
      return true
  }
}
