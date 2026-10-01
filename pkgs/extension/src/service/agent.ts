import * as fs from 'fs/promises'
import { parse } from 'jsonc-parser'
import { existsSync } from 'node:fs'
import * as path from 'node:path'
import { v4 } from 'uuid'
import * as vscode from 'vscode'

import { locale } from '@nekosu/maa-locale'

import pkg from '../../../../release/package.json'
import { logger } from '../utils/logger'
import { BaseService } from './context'
import { nativeService, rootService, serverService } from './registry'

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
      this.reapDebugSession(event)
      if (event.configuration.__mse_agent_id) {
        this.agentStopped(event.configuration.__mse_agent_id)
      }
    })
  }

  // Agent 进程可能在未被显式 stopAgent 的情况下退出（例如 OOM）。这里按 session id 摘掉
  // 残留记录，否则后续清理会拿已经终止的 session 去调 stopDebugging，编辑器会以
  // "debug session not found" 拒绝。
  private reapDebugSession(session: vscode.DebugSession) {
    for (const [id, info] of Object.entries(this.agents)) {
      if (info.type === 'debug' && info.session.id === session.id) {
        delete this.agents[id]
      }
    }
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
    // handle 必须在 startDebugging 之前写入配置：onDidTerminateDebugSession 会把它原样
    // 带回，maa-server 侧 setupAgent 的 watcher 以它与本函数的返回值匹配，agent 提前退出
    // 时 setup 才能立即失败，而不是空等 agentTimeout
    const id = v4()
    config.__mse_agent_id = id

    let session: vscode.DebugSession | undefined = undefined
    const disp = vscode.debug.onDidStartDebugSession(s => {
      // 并发可能启动无关的调试会话，只认带自己 handle 的
      if (s.configuration.__mse_agent_id === id) {
        session = s
      }
    })
    const succ = await vscode.debug.startDebugging(vscode.workspace.workspaceFolders![0], config)
    disp.dispose()
    if (!(succ && session)) {
      logger.error('Create debug session failed')
      return null
    }

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

    try {
      switch (info.type) {
        case 'task':
          info.task.terminate()
          break
        case 'debug':
          await vscode.debug.stopDebugging(info.session)
          break
      }
    } catch (err) {
      // session 可能已经终止：编辑器会以 "debug session not found" 拒绝，属于预期竞态
      logger.warn(`stop agent ${id} failed: ${err}`)
    }
  }

  async stopAll() {
    await Promise.all(Object.keys(this.agents).map(id => this.stopAgent(id)))
  }

  async agentStopped(id: string) {
    // kill() 重建窗口内 stopAll 的 terminate 事件仍会异步到达：此时拉起 server 会与
    // 重试路径并发 ensureServer，ensureConnection 开头就会杀掉重试刚启动的进程；且新建
    // 的 server 也不持有旧 agent 的 watcher，通知本就无意义，因此只在有连接时发送
    if (!serverService.rpc.conn) {
      return
    }
    try {
      await (await serverService.ensureServer())?.agentStopped(id)
    } catch (err) {
      logger.warn(`notify agentStopped ${id} failed: ${err}`)
    }
  }
}
