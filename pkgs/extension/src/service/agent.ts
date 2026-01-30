import { existsSync } from 'fs'
import * as fs from 'fs/promises'
import { parse } from 'jsonc-parser'
import path from 'path'
import { v4 } from 'uuid'
import * as vscode from 'vscode'

import { logger } from '@mse/utils'

import { currentWorkspace } from '../utils/fs'
import { BaseService } from './context'

type AgentInfo =
  | {
      type: 'task'
      task: vscode.TaskExecution
    }
  | {
      type: 'debug'
      session: vscode.DebugSession
    }

export class AgentService extends BaseService {
  agents: Record<string, AgentInfo>

  constructor() {
    super()

    this.agents = {}
  }

  async init() {}

  async startTask(exec: string, args: string[], cwd: string, env: Record<string, string>) {
    const task = new vscode.Task(
      {
        type: 'shell'
      },
      vscode.TaskScope.Workspace,
      'maa-agent-server',
      'maa',
      new vscode.ShellExecution(exec, args, {
        cwd,
        env
      })
    )
    const id = v4()
    this.agents[id] = {
      type: 'task',
      task: await vscode.tasks.executeTask(task)
    }
    return id
  }

  async startDebugSession(name: string, identifier: string) {
    const launchJsonPath = path.join(currentWorkspace()!.fsPath, '.vscode', 'launch.json')
    if (!existsSync(launchJsonPath)) {
      logger.error('Cannot find launch.json')
      return null
    }
    const launchJson = parse(await fs.readFile(launchJsonPath, 'utf8')) as {
      configurations: vscode.DebugConfiguration[]
    }
    const config = launchJson.configurations.find(cfg => cfg.name === name)
    if (!config) {
      logger.error(`Cannot find debug session ${name}`)
      return null
    }
    let replaced = false
    for (const key of Object.keys(config)) {
      const val = config[key]
      if (Array.isArray(val)) {
        config[key] = val.map(v => {
          if (typeof v === 'string' && v === '{AGENT_ID}') {
            logger.info(`Replace {AGENT_ID} in ${key}`)
            replaced = true
            return identifier
          } else {
            return v
          }
        })
      }
    }
    if (!replaced) {
      logger.warn('No {AGENT_ID} found in config')
    }

    let session: vscode.DebugSession | undefined = undefined
    const disp = vscode.debug.onDidStartDebugSession(s => {
      session = s
    })
    const succ = await vscode.debug.startDebugging(vscode.workspace.workspaceFolders![0], config)
    disp.dispose()
    if (!(succ && session)) {
      logger.error('Create debug session failed')
      return null
    }

    const id = v4()
    this.agents[id] = {
      type: 'debug',
      session
    }
    return id
  }

  async stopAgent(id: string) {
    const info = this.agents[id]
    if (!info) {
      return
    }
    delete this.agents[id]

    switch (info.type) {
      case 'task':
        info.task.terminate()
        break
      case 'debug':
        await vscode.debug.stopDebugging(info.session)
        break
    }
  }

  async stopAll() {
    await Promise.all(Object.keys(this.agents).map(id => this.stopAgent(id)))
  }
}
