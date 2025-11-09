import { BaseImpl } from './base'
import { MacImpl } from './mac/filedialog'
import { WinImpl } from './win/filedialog'

let impl: BaseImpl | null = null

export function getFileDialogImpl() {
  if (!impl) {
    switch (process.platform) {
      case 'win32':
        impl = new WinImpl()
        break
      case 'darwin':
        impl = new MacImpl()
        break
      default:
        impl = new BaseImpl()
    }
  }
  return impl
}
