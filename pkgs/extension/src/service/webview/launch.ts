import * as vscode from 'vscode'

import { locale } from '@mse/locale'
import { TaskName } from '@mse/pipeline-manager'
import { LaunchHostState, LaunchHostToWeb, LaunchWebToHost, WebToHost } from '@mse/types'
import { WebviewPanelProvider } from '@mse/utils'

import { interfaceService, nativeService, serverService, stateService } from '..'
import { commands } from '../../command'
import { isMaaAssistantArknights } from '../../utils/fs'
import { context } from '../context'
import { IpcType } from '../server'
import { WebviewCropPanel } from './crop'
import { isLaunchDev } from './dev'

export class WebviewLaunchPanel extends WebviewPanelProvider<LaunchHostToWeb, LaunchWebToHost> {
  ipc: IpcType
  instance: string
  knownTasks: string[]
  stopped: boolean = false

  paused: boolean = false
  pausedResolve?: () => void

  constructor(ipc: IpcType, instance: string, title: string, viewColumn?: vscode.ViewColumn) {
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

    this.ipc = ipc
    this.instance = instance
    this.knownTasks = []

    this.setup()
  }

  async setup() {
    this.knownTasks = (await this.ipc.getKnownTasks(this.instance)) ?? []
  }

  dispose() {
    console.log('launch panel dispose')

    this.send = () => {}
    this.stop().then(() => {
      this.ipc.destroyInstance(this.instance)
    })

    delete serverService.instMap[this.instance]
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
        const detail = await this.ipc.getRecoDetail(
          this.instance,
          data.reco_id.toString() as maa.RecoId
        )
        this.response(data.seq, detail)
        break
      }
      case 'requestAct': {
        const detail = await this.ipc.getActDetail(
          this.instance,
          data.action_id.toString() as maa.ActId
        )
        this.response(data.seq, detail)
        break
      }
      case 'requestNode': {
        const nodeData = await this.ipc.getNode(this.instance, data.node)
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
        const panel = new WebviewCropPanel(this.ipc, 'Maa Crop')
        await panel.init()
        panel.send({
          command: 'setImage',
          image: data.image
        })
        break
      }
      case 'gotoTask':
        vscode.commands.executeCommand(commands.GotoTask, data.task)
        break
      case 'taskDoc':
        this.response(
          data.seq,
          interfaceService.interfaceBundle?.topLayer.getTaskDoc(data.task as TaskName) ?? ''
        )
        break
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
    await this.ipc.postStop(this.instance)
  }

  finish() {
    if (this.stopped) {
      return
    }
    this.stopped = true
    this.pushState()
  }

  async pushNotify(msg: maa.TaskerNotify | maa.TaskerContextNotify) {
    this.send({
      command: 'notifyStatus',
      msg
    })
    if (
      msg.msg === 'PipelineNode.Starting' ||
      msg.msg === 'ActionNode.Starting' ||
      msg.msg === 'RecognitionNode.Starting' ||
      msg.msg === 'NextList.Starting'
    ) {
      if (stateService.state.breakTasks?.includes(msg.name)) {
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
      fwStatus: nativeService.currentVersionInfo,
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
