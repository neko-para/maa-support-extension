import vscode from 'vscode'

import {
  CropViewContext,
  CropViewFromHost,
  CropViewToHost,
  LaunchViewContext,
  LaunchViewFromHost,
  LaunchViewToHost
} from '@mse/types'
import { createUseWebPanel } from '@mse/utils'

import { isCropDev, isLaunchDev } from './service/webview/dev'

const innerUseLaunchView = createUseWebPanel<
  LaunchViewContext,
  LaunchViewToHost,
  LaunchViewFromHost
>('controlPanel', 'launch', 'maa.view.launch', isLaunchDev, true)

export async function useLaunchView(column: vscode.ViewColumn = vscode.ViewColumn.Active) {
  return await innerUseLaunchView('Maa Launch', column)
}

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
