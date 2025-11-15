import { BrowserBaseImpl } from '../base/browser'
import { launchOSAScript } from './utils'

export class BrowserMacImpl extends BrowserBaseImpl {
  async openUrl(url: string): Promise<void> {
    await launchOSAScript(`open location "${url}"`)
  }
}
