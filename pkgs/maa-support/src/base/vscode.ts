import { HostApiMeta } from '@maaxyz/maa-support-types'
import axios from 'axios'

import {
  BrowserBaseImpl,
  FileDialogBaseImpl,
  FileDialogOption,
  setBrowserImpl,
  setFileDialogImpl
} from '@nekosu/native-tools'

import { vscodeService } from '.'
import { handle } from '../server'
import { BaseService } from './base'

export class FileDialogVscodeImpl extends FileDialogBaseImpl {
  async openFile(option: FileDialogOption): Promise<string[] | null> {
    return (
      (
        await vscodeService.request('nativeOpenFile', {
          option
        })
      )?.files ?? null
    )
  }

  async saveFile(option: FileDialogOption): Promise<string | null> {
    return (
      (
        await vscodeService.request('nativeSaveFile', {
          option
        })
      )?.files ?? null
    )
  }

  async openFolder(option: FileDialogOption): Promise<string[] | null> {
    return (
      (
        await vscodeService.request('nativeOpenFolder', {
          option
        })
      )?.files ?? null
    )
  }
}

export class BrowserVscodeImpl extends BrowserBaseImpl {
  async openUrl(url: string): Promise<void> {
    await vscodeService.request('nativeOpenUrl', {
      url
    })
  }
}

export class VscodeService extends BaseService {
  hostPort: number | null = null
  loaded: boolean = false

  listen() {
    handle('/host/forward', async req => {
      if (!this.hostPort) {
        console.log('no host!')
        return {
          data: null
        }
      }
      try {
        const resp = await axios({
          baseURL: `http://localhost:${this.hostPort}`,
          url: `/${req.method}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          data: JSON.stringify(req.data),
          responseType: 'json'
        })
        return {
          data: resp.data
        }
      } catch {
        return {
          data: null
        }
      }
    })
  }

  setup(port: number) {
    this.hostPort = port
    this.loaded = true

    setFileDialogImpl(new FileDialogVscodeImpl())
    setBrowserImpl(new BrowserVscodeImpl())
  }

  async request<Method extends keyof HostApiMeta>(
    method: Method,
    req: HostApiMeta[Method]['req']
  ): Promise<HostApiMeta[Method]['rsp'] | null> {
    if (!this.hostPort) {
      console.log('no host!')
      return null
    }
    try {
      const resp = await axios({
        baseURL: `http://localhost:${this.hostPort}`,
        url: `/${method}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        data: JSON.stringify(req),
        responseType: 'json'
      })
      return resp.data
    } catch {
      return null
    }
  }
}
