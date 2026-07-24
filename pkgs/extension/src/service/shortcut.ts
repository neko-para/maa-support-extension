import { randomUUID } from 'node:crypto'
import * as vscode from 'vscode'

import { logger } from '@mse/utils'

import { BaseService, context } from './context'

export type ShortcutCommand = 'start' | 'toggle-pause' | 'stop' | 'screencap'
export type ShortcutRoute = 'local' | 'forwarded' | 'missing'

type TargetLease = {
  owner: string
}

type CommandRequest = {
  command: ShortcutCommand
  createdAt: number
}

const heartbeatInterval = 5_000
const leaseTimeout = 15_000
const requestTimeout = 30_000

export class ShortcutService extends BaseService {
  private readonly windowId = randomUUID()
  private readonly rootUri = vscode.Uri.joinPath(context.globalStorageUri, 'shortcut-control')
  private readonly targetUri = vscode.Uri.joinPath(this.rootUri, 'target.json')
  private readonly sessionDir = vscode.Uri.joinPath(this.rootUri, 'sessions')
  private readonly sessionUri = vscode.Uri.joinPath(this.sessionDir, `${this.windowId}.session`)
  private readonly requestDir = vscode.Uri.joinPath(this.rootUri, 'requests')

  private commandHandler?: (command: ShortcutCommand) => Promise<void>
  private polling = false
  private lastHeartbeat = 0
  private target = false

  private readonly targetChanged = new vscode.EventEmitter<boolean>()
  readonly onTargetChanged = this.targetChanged.event

  get isTarget() {
    return this.target
  }

  async init() {
    console.log('init ShortcutService')

    await vscode.workspace.fs.createDirectory(this.sessionDir)
    await vscode.workspace.fs.createDirectory(this.requestDir)
    await this.writeSession()
    this.lastHeartbeat = Date.now()
    await this.poll()

    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.rootUri.fsPath, '**/*')
    )
    this.defer = watcher
    this.defer = watcher.onDidCreate(() => {
      void this.poll()
    })
    this.defer = watcher.onDidChange(() => {
      void this.poll()
    })
    this.defer = watcher.onDidDelete(() => {
      void this.poll()
    })

    const timer = setInterval(() => {
      void this.poll()
    }, heartbeatInterval)
    this.defer = {
      dispose: () => clearInterval(timer)
    }
    this.defer = this.targetChanged
    this.defer = {
      dispose: () => {
        void this.release()
      }
    }
  }

  setCommandHandler(handler: (command: ShortcutCommand) => Promise<void>) {
    this.commandHandler = handler
  }

  async activate() {
    await this.writeSession()
    await this.writeLease({ owner: this.windowId })
    await this.updateTargetState(true)
  }

  async route(command: ShortcutCommand): Promise<ShortcutRoute> {
    const lease = await this.readLease()
    if (!lease) {
      return 'missing'
    }
    if (lease.owner === this.windowId) {
      return 'local'
    }

    const request: CommandRequest = {
      command,
      createdAt: Date.now()
    }
    const requestId = randomUUID()
    const temporaryUri = vscode.Uri.joinPath(this.requestDir, `${requestId}.tmp`)
    const requestUri = vscode.Uri.joinPath(this.requestDir, `${requestId}.json`)
    await vscode.workspace.fs.writeFile(temporaryUri, Buffer.from(JSON.stringify(request)))
    await vscode.workspace.fs.rename(temporaryUri, requestUri)
    return 'forwarded'
  }

  private async poll() {
    if (this.polling) {
      return
    }
    this.polling = true
    try {
      const now = Date.now()
      if (now - this.lastHeartbeat >= heartbeatInterval) {
        await this.writeSession()
        this.lastHeartbeat = now
      }

      const lease = await this.readLease()
      const isTarget = lease?.owner === this.windowId
      await this.updateTargetState(isTarget)

      if (!isTarget) {
        return
      }
      await this.processRequests()
    } catch (err) {
      logger.error(`shortcut control poll failed: ${err}`)
    } finally {
      this.polling = false
    }
  }

  private async processRequests() {
    if (!this.commandHandler) {
      return
    }

    const now = Date.now()
    for (const [name, type] of await vscode.workspace.fs.readDirectory(this.requestDir)) {
      if (type !== vscode.FileType.File || !name.endsWith('.json')) {
        continue
      }

      const requestUri = vscode.Uri.joinPath(this.requestDir, name)
      try {
        const request = JSON.parse(
          Buffer.from(await vscode.workspace.fs.readFile(requestUri)).toString()
        ) as CommandRequest
        await vscode.workspace.fs.delete(requestUri)
        if (now - request.createdAt <= requestTimeout) {
          await this.commandHandler(request.command)
        }
      } catch (err) {
        logger.error(`shortcut request failed: ${err}`)
        await vscode.workspace.fs.delete(requestUri).then(undefined, () => {})
      }
    }
  }

  private async readLease(): Promise<TargetLease | null> {
    try {
      const lease = JSON.parse(
        Buffer.from(await vscode.workspace.fs.readFile(this.targetUri)).toString()
      ) as TargetLease
      if (!lease.owner) {
        return null
      }

      const sessionUri = vscode.Uri.joinPath(this.sessionDir, `${lease.owner}.session`)
      const updatedAt = Number(
        Buffer.from(await vscode.workspace.fs.readFile(sessionUri)).toString()
      )
      if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > leaseTimeout) {
        const current = JSON.parse(
          Buffer.from(await vscode.workspace.fs.readFile(this.targetUri)).toString()
        ) as TargetLease
        if (current.owner === lease.owner) {
          await vscode.workspace.fs.delete(this.targetUri).then(undefined, () => {})
        }
        return null
      }
      return lease
    } catch {
      return null
    }
  }

  private async writeLease(lease: TargetLease) {
    await vscode.workspace.fs.createDirectory(this.rootUri)
    await vscode.workspace.fs.writeFile(this.targetUri, Buffer.from(JSON.stringify(lease)))
  }

  private async writeSession() {
    await vscode.workspace.fs.writeFile(this.sessionUri, Buffer.from(Date.now().toString()))
  }

  private async updateTargetState(target: boolean) {
    if (this.target === target) {
      return
    }
    this.target = target
    this.targetChanged.fire(target)
  }

  private async release() {
    const lease = await this.readLease()
    if (lease?.owner === this.windowId) {
      await vscode.workspace.fs.delete(this.targetUri).then(undefined, () => {})
    }
    await vscode.workspace.fs.delete(this.sessionUri).then(undefined, () => {})
  }
}
