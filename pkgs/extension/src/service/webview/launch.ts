import * as vscode from 'vscode'

import { LaunchHostState, LaunchHostToWeb, LaunchWebToHost, WebToHost } from '@mse/types'
import { WebviewPanelProvider, locale } from '@mse/utils'

import { stateService } from '..'
import { isMaaAssistantArknights } from '../../utils/fs'
import { context } from '../context'
import { TaskerInstance } from '../launch'
import { toPngDataUrl } from '../utils/png'
import { WebviewCropPanel } from './crop'
import { isLaunchDev } from './dev'

export class WebviewLaunchPanel extends WebviewPanelProvider<LaunchHostToWeb, LaunchWebToHost> {
  instance: TaskerInstance
  knownTasks: string[]
  stopped: boolean = false

  paused: boolean = false
  pausedResolve?: () => void

  constructor(instance: TaskerInstance, title: string, viewColumn?: vscode.ViewColumn) {
    super({
      context,
      folder: 'webview',
      index: 'launch',
      webId: 'maa.view.launch',
      title,
      viewColumn: viewColumn ?? vscode.ViewColumn.Active,
      preserveFocus: false,
      iconPath: 'images/logo.png',
      dev: isLaunchDev
    })

    this.instance = instance
    this.knownTasks = this.instance.resource.node_list ?? []
    this.knownTasks.sort()

    this.instance.tasker.add_sink(async (_, msg) => {
      await this.pushNotify(msg.msg, JSON.stringify(msg))
    })
    this.instance.tasker.add_context_sink(async (_, msg) => {
      await this.pushNotify(msg.msg, JSON.stringify(msg))
    })
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
        const detailInfo = this.instance.tasker.recognition_detail(
          data.reco_id.toString() as maa.RecoId
        )
        if (!detailInfo) {
          this.response(data.seq, null)
          break
        }
        const info = {
          ...detailInfo
        } as Partial<typeof detailInfo>
        delete info.raw
        delete info.draws
        this.response(data.seq, {
          raw: toPngDataUrl(detailInfo.raw),
          draws: detailInfo.draws.map(toPngDataUrl),
          info
        })
        break
      }
      case 'requestNode': {
        const nodeData = this.instance.tasker.resource?.get_node_data(data.node) ?? null
        this.response(data.seq, nodeData)
        break
      }
      case 'requestPause':
        this.pause()
        this.response(data.seq, null)
        break
      case 'requestContinue':
        this.cont()
        this.response(data.seq, null)
        break
      case 'updateBreakTasks':
        stateService.reduce({
          breakTasks: data.tasks
        })
        this.pushState()
        break
      case 'openCrop': {
        const panel = new WebviewCropPanel('Maa Crop')
        await panel.init()
        panel.send({
          command: 'setImage',
          image: data.image
        })
        break
      }
    }
    if (data.builtin) {
      super.recv(data)
    }
  }

  pause() {
    this.paused = true
    this.pushState()
  }

  cont() {
    if (this.pausedResolve) {
      setTimeout(this.pausedResolve, 0)
      this.pausedResolve = undefined
    }
    this.paused = false
    this.pushState()
  }

  async stop() {
    if (this.stopped) {
      return
    }
    this.stopped = true
    this.cont()
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
    if (msg === 'Node.NextList.Starting') {
      const task = JSON.parse(details).name as string
      if (stateService.state.breakTasks?.includes(task)) {
        this.pause()
      }
    }
    if (this.paused) {
      await new Promise<void>(resolve => {
        this.pausedResolve = resolve
      })
    }
  }

  get state(): LaunchHostState {
    return {
      isMAA: isMaaAssistantArknights,
      locale,

      stopped: this.stopped,
      paused: this.paused,
      knownTasks: this.knownTasks,
      breakTasks: stateService.state.breakTasks
    }
  }

  pushState() {
    this.send({
      command: 'updateState',
      state: this.state
    })
  }
}
