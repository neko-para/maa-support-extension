import { BrowserBaseImpl } from './base/browser'
import { FileDialogBaseImpl, FileDialogOption } from './base/filedialog'
import { BrowserMacImpl } from './mac/browser'
import { FileDialogMacImpl } from './mac/filedialog'
import { BrowserWinImpl } from './win/browser'
import { FileDialogWinImpl } from './win/filedialog'

export { FileDialogBaseImpl, FileDialogOption, BrowserBaseImpl }

let fileDialogImpl: FileDialogBaseImpl | null = null

export function setFileDialogImpl(impl: FileDialogBaseImpl) {
  fileDialogImpl = impl
}
export function getFileDialogImpl() {
  if (!fileDialogImpl) {
    switch (process.platform) {
      case 'win32':
        fileDialogImpl = new FileDialogWinImpl()
        break
      case 'darwin':
        fileDialogImpl = new FileDialogMacImpl()
        break
      default:
        fileDialogImpl = new FileDialogBaseImpl()
    }
  }
  return fileDialogImpl
}

let browserImpl: BrowserBaseImpl | null = null

export function setBrowserImpl(impl: BrowserBaseImpl) {
  browserImpl = impl
}
export function getBrowserImpl() {
  if (!browserImpl) {
    switch (process.platform) {
      case 'win32':
        browserImpl = new BrowserWinImpl()
        break
      case 'darwin':
        browserImpl = new BrowserMacImpl()
        break
      default:
        browserImpl = new BrowserBaseImpl()
    }
  }
  return browserImpl
}
