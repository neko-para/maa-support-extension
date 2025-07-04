import {
  ContinuedEvent,
  DebugSession,
  ExitedEvent,
  InitializedEvent,
  OutputEvent,
  StoppedEvent,
  TerminatedEvent,
  Thread
} from '@vscode/debugadapter'
import type { DebugProtocol } from '@vscode/debugprotocol'
import { v4 } from 'uuid'
import * as vscode from 'vscode'

import { BaseService } from './context'

export class MaaDebugSession extends DebugSession {
  constructor(session: vscode.DebugSession) {
    super()
  }

  pushMessage(message: string) {
    this.sendEvent(new OutputEvent(message + '\n'))
  }

  pushContinued() {
    this.sendEvent(new ContinuedEvent(1))
  }

  pushExited() {
    this.sendEvent(new TerminatedEvent())
  }

  pushTerminated() {
    this.sendEvent(new TerminatedEvent())
  }

  async handlePause() {}
  async handleContinue() {}
  async handleTerminate() {}

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments
  ): void {
    console.log('initialize', args)

    response.body = response.body || {}
    this.sendResponse(response)
    this.sendEvent(new InitializedEvent())
  }

  protected launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: DebugProtocol.LaunchRequestArguments
  ): void {
    console.log('launch', args)

    this.sendResponse(response)
    this.sendEvent(new StoppedEvent('entry', 1))
  }

  protected attachRequest(
    response: DebugProtocol.AttachResponse,
    args: DebugProtocol.AttachRequestArguments
  ): void {
    console.log('attach', args)

    this.sendResponse(response)
    this.sendEvent(new StoppedEvent('entry', 1))
  }

  protected async pauseRequest(
    response: DebugProtocol.PauseResponse,
    args: DebugProtocol.PauseArguments
  ): Promise<void> {
    console.log('pause', args)

    await this.handlePause()

    this.sendResponse(response)
    this.sendEvent(new StoppedEvent('pause', 1))
  }

  protected async continueRequest(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueArguments
  ): Promise<void> {
    console.log('continue', args)

    await this.handleContinue()

    this.sendResponse(response)
    this.sendEvent(new ContinuedEvent(1))
  }

  protected async disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    args: DebugProtocol.DisconnectArguments
  ): Promise<void> {
    console.log('disconnect', args)

    await this.handleTerminate()

    this.sendResponse(response)
    this.sendEvent(new TerminatedEvent())
  }

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = {
      threads: [new Thread(1, 'Main')]
    }
    this.sendResponse(response)
  }
}

export class DebugService extends BaseService implements vscode.DebugAdapterDescriptorFactory {
  sessions: Record<string, (session: MaaDebugSession) => void>

  constructor() {
    super()
    console.log('construct DebugService')

    this.sessions = {}

    this.defer = vscode.debug.registerDebugAdapterDescriptorFactory('maa-launch', this)
  }

  async init() {
    console.log('init DebugService')
  }

  async startSession() {
    const id = v4()
    const pro = new Promise<MaaDebugSession>(resolve => {
      this.sessions[id] = resolve
    })
    await vscode.debug.startDebugging(vscode.workspace.workspaceFolders?.[0], {
      name: 'maa-support-launch',
      type: 'maa-launch',
      request: 'launch',
      maa_id: id
    })
    return pro
  }

  createDebugAdapterDescriptor(
    session: vscode.DebugSession,
    executable: vscode.DebugAdapterExecutable | undefined
  ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    const maa_session = new MaaDebugSession(session)
    this.sessions[session.configuration.maa_id]?.(maa_session)
    delete this.sessions[session.configuration.maa_id]
    return new vscode.DebugAdapterInlineImplementation(maa_session)
  }
}
