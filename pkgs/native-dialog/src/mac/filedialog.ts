import { BaseImpl, FileDialogOption } from '../base'
import { launchOSAScript } from './utils'

export class MacImpl extends BaseImpl {
  async openFile(option: FileDialogOption): Promise<string[] | null> {
    const result = await launchOSAScript(
      `POSIX path of (choose file ${option.title ? `with prompt "${option.title}"` : ''})`
    )

    if (result) {
      return result.split('\n').filter(x => !!x)
    } else {
      return null
    }
  }

  async saveFile(option: FileDialogOption): Promise<string | null> {
    return launchOSAScript(
      `POSIX path of (choose file name ${option.title ? `with prompt "${option.title}"` : ''} ${option.defaultFile ? `default name "${option.defaultFile}"` : ''})`
    )
  }

  async openFolder(option: FileDialogOption): Promise<string[] | null> {
    const result = await launchOSAScript(
      `POSIX path of (choose folder ${option.title ? `with prompt "${option.title}"` : ''})`
    )
    if (result) {
      return result.split('\n').filter(x => !!x)
    } else {
      return null
    }
  }
}
