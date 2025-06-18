import vscode from 'vscode'

import { CropViewContext, CropViewFromHost, CropViewToHost } from '@mse/types'
import { createUseWebPanel } from '@mse/utils'

import { isCropDev, isLaunchDev } from './service/webview/dev'

const innerUseCropView = createUseWebPanel<CropViewContext, CropViewToHost, CropViewFromHost>(
  'controlPanel',
  'crop',
  'maa.view.crop',
  isCropDev,
  true
)

export async function useCropView(column: vscode.ViewColumn = vscode.ViewColumn.Active) {
  return await innerUseCropView('Maa Crop', column)
}
