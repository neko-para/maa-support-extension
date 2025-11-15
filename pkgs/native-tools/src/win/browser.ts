import { BrowserBaseImpl } from '../base/browser'
import { launchPowershell } from './utils'

export class BrowserWinImpl extends BrowserBaseImpl {
  async openUrl(url: string): Promise<void> {
    await launchPowershell(`Start-Process "${url}"`, false)
  }
}
