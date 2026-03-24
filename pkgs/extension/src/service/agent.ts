import * as fs from 'fs/promises'
import { parse } from 'jsonc-parser'
import { existsSync } from 'node:fs'
import * as path from 'node:path'
import { v4 } from 'uuid'
import * as vscode from 'vscode'

import { logger } from '@mse/utils'
import { locale } from '@nekosu/maa-locale'

import { nativeService, rootService, serverService } from '.'
import pkg from '../../../../release/package.json'
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

    this.defer = vscode.tasks.onDidEndTask(event => {
      if (event.execution.task.definition.__mse_agent_id) {
        this.agentStopped(event.execution.task.definition.__mse_agent_id)
      }
    })
    this.defer = vscode.debug.onDidTerminateDebugSession(event => {
      if (event.configuration.__mse_agent_id) {
        this.agentStopped(event.configuration.__mse_agent_id)
      }
    })
  }

  async init() {}

  wrapEnv(env: Record<string, string>) {
    return {
      ...env,
      PI_INTERFACE_VERSION: 'v2.5.0',
      PI_CLIENT_NAME: 'VsCode',
      PI_CLIENT_VERSION: pkg.version,
      PI_CLIENT_LANGUAGE: locale,
      PI_CLIENT_MAAFW_VERSION: nativeService.version,
      PI_VERSION: '',
      PI_CONTROLLER: '{}',
      PI_RESOURCE: '{}'
    }
  }

  async startTask(exec: string, args: string[], cwd: string, env: Record<string, string>) {
    const id = v4()
    const task = new vscode.Task(
      {
        type: 'mse-agent-task',
        __mse_agent_id: id
      },
      vscode.TaskScope.Workspace,
      'maa-agent-server',
      'maa',
      new vscode.ShellExecution(exec, args, {
        cwd,
        env: this.wrapEnv(env)
      })
    )
    this.agents[id] = {
      type: 'task',
      task: await vscode.tasks.executeTask(task)
    }
    return id
  }

  async startDebugSession(name: string, identifier: string, env: Record<string, string>) {
    const launchJsonPath = path.join(
      rootService.activeResource!.workspace.fsPath,
      '.vscode',
      'launch.json'
    )
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
      } else if (typeof val === 'string' && val === '{AGENT_ENV}') {
        config[key] = this.wrapEnv(env)
      }
    }
    if (!replaced) {
      logger.warn('No {AGENT_ID} found in config')
    }
    config.__mse_agent_id = identifier

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

  async agentStopped(id: string) {
    await (await serverService.ensureServer())?.agentStopped(id)
  }
}
