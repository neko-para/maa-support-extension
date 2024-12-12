import * as vscode from 'vscode'

export type * as Maa from '@maaxyz/maa-node'

export let maa: typeof import('@maaxyz/maa-node')

export function setupMaa() {
  maa = vscode.extensions.getExtension('nekosu.maa-node')?.exports
}
