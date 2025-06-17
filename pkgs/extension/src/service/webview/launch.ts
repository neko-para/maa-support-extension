import * as vscode from 'vscode'

import { LaunchHostState, LaunchHostToWeb, LaunchWebToHost, WebToHost } from '@mse/types'
import { WebviewPanelProvider } from '@mse/utils'

import { Maa } from '../../maa'
import { toPngDataUrl } from '../../webview/utils'
import { context } from '../context'
import { TaskerInstance } from '../launch'
import { isLaunchDev } from './dev'

export class WebviewLaunchPanel extends WebviewPanelProvider<LaunchHostToWeb, LaunchWebToHost> {
  instance: TaskerInstance
  stopped: boolean = false

  constructor(instance: TaskerInstance, title: string, viewColumn?: vscode.ViewColumn) {
    super({
      context,
      folder: 'webview',
      index: 'launch',
      webId: 'maa.view.launch',
      title,
      viewColumn: viewColumn ?? vscode.ViewColumn.Active,
      preserveFocus: false,
      dev: isLaunchDev
    })

    this.instance = instance

    const oldNotify = this.instance.tasker.notify
    this.instance.tasker.notify = async (msg, detail) => {
      await oldNotify(msg, detail)
      await this.pushNotify(msg, detail)
    }
  }

  dispose() {
    console.log('launch panel dispose')

    this.send = () => {}
    this.stop().then(() => {
      this.instance.tasker.destroy()
      this.instance.resource.destroy()
      this.instance.agent?.terminate()
    })
  }

  async recv(data: WebToHost<LaunchWebToHost>) {
    switch (data.command) {
      case '__init':
        this.pushState()
        break
      case 'requestStop':
        await this.stop()
        this.pushState()
        break
      case 'requestReco': {
        const detailInfo = this.instance.tasker.recognition_detail(data.reco_id as Maa.api.RecoId)
        if (!detailInfo) {
          this.response(data.seq, null)
          break
        }
        this.response(data.seq, {
          raw: toPngDataUrl(detailInfo.raw),
          draws: detailInfo.draws.map(toPngDataUrl),
          info: detailInfo
        })
        break
      }
    }
    if (data.builtin) {
      super.recv(data)
    }
  }

  async stop() {
    if (this.stopped) {
      return
    }
    this.stopped = true
    await this.instance.tasker.post_stop().wait()
  }

  finish() {
    if (this.stopped) {
      return
    }
    this.stopped = true
    this.pushState()
  }

  async pushNotify(msg: string, details: string) {
    this.send({
      command: 'notifyStatus',
      msg,
      details
    })
  }

  get state(): LaunchHostState {
    return {
      stopped: this.stopped
    }
  }

  pushState() {
    this.send({
      command: 'updateState',
      state: this.state
    })
  }
}
