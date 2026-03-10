import * as fs from 'fs/promises'
import { existsSync } from 'node:fs'
import * as path from 'node:path'
import { v4 } from 'uuid'
import * as vscode from 'vscode'

import type {
  AgentConfig,
  ControllerRuntime,
  InterfaceConfig,
  InterfaceRuntime
} from '@nekosu/maa-pipeline-manager'
import {
  type Interface,
  InterfaceBundle,
  buildControllerRuntime,
  buildResourceRuntime,
  buildTaskRuntime
} from '@nekosu/maa-pipeline-manager'

import { diagnosticService, rootService, serverService } from '.'
import { MaaErrorDelegateImpl } from '../utils/eval'
import { isMaaAssistantArknights } from '../utils/fs'
import { BaseService } from './context'
import { VscodeContentLoader, VscodeContentWatcher } from './utils/content'

export class InterfaceService extends BaseService {
  interfaceBundle?: InterfaceBundle
  interfaceConfigJson: InterfaceConfig

  get interfaceJson(): Interface {
    if (!this.interfaceBundle?.content.object) {
      return {}
    }

    const final = structuredClone(this.interfaceBundle.content.object)
    final.task = final.task ?? []
    final.option = final.option ?? {}
    final.preset = final.preset ?? []
    for (const imp of this.interfaceBundle.imports) {
      if (imp.object) {
        if (imp.object.task) {
          final.task.push(...imp.object.task)
        }
        if (imp.object.option) {
          Object.assign(final.option, imp.object.option)
        }
        if (imp.object.preset) {
          final.preset.push(...imp.object.preset)
        }
      }
    }
    return final
  }

  get resourcePaths(): vscode.Uri[] {
    return (
      this.interfaceBundle?.paths.map(dir =>
        vscode.Uri.file(path.join(this.interfaceBundle!.root, dir))
      ) ?? []
    )
  }

  watchInterface?: vscode.Disposable

  interfaceChanged: vscode.EventEmitter<void> = new vscode.EventEmitter()
  get onInterfaceChanged() {
    return this.interfaceChanged.event
  }

  interfaceImportChanged: vscode.EventEmitter<void> = new vscode.EventEmitter()
  get onInterfaceImportChanged() {
    return this.interfaceImportChanged.event
  }

  interfaceConfigChanged: vscode.EventEmitter<void> = new vscode.EventEmitter()
  get onInterfaceConfigChanged() {
    return this.interfaceConfigChanged.event
  }

  resourceChanged: vscode.EventEmitter<void> = new vscode.EventEmitter()
  get onResourceChanged() {
    return this.resourceChanged.event
  }

  pipelineChanged: vscode.EventEmitter<void> = new vscode.EventEmitter()
  get onPipelineChanged() {
    return this.pipelineChanged.event
  }

  localeChanged: vscode.EventEmitter<void> = new vscode.EventEmitter()
  get onLocaleChanged() {
    return this.localeChanged.event
  }

  constructor() {
    super()
    console.log('construct InterfaceService')

    this.interfaceConfigJson = {}

    this.defer = this.interfaceChanged
    this.defer = this.interfaceImportChanged
    this.defer = this.interfaceConfigChanged
    this.defer = this.resourceChanged
    this.defer = this.pipelineChanged
    this.defer = this.localeChanged

    this.defer = {
      dispose: () => {
        this.watchInterface?.dispose()
      }
    }

    this.defer = rootService.onActiveResourceChanged(() => {
      this.loadInterface()
    })

    this.defer = this.onInterfaceChanged(() => {
      this.updateResource()
      diagnosticService.scanner.scheduleFlush()
    })

    this.defer = this.onInterfaceConfigChanged(() => {
      this.updateResource()
    })

    this.defer = this.onPipelineChanged(() => {
      diagnosticService.scanner.scheduleFlush()
    })
  }

  async init() {
    console.log('init InterfaceService')
  }

  async loadInterface() {
    this.interfaceBundle?.stop()

    this.interfaceBundle = undefined
    this.interfaceConfigJson = {}

    const root = rootService.activeResource
    if (!root) {
      return
    }

    this.interfaceBundle = new InterfaceBundle(
      new VscodeContentLoader(),
      new VscodeContentWatcher(),
      isMaaAssistantArknights,
      root.dirUri.fsPath,
      path.basename(root.interfaceUri.fsPath)
    )
    this.interfaceBundle.evalErrorDelegate = new MaaErrorDelegateImpl()
    this.interfaceBundle.on('interfaceChanged', () => {
      this.interfaceChanged.fire()
    })
    this.interfaceBundle.on('importChanged', () => {
      this.interfaceImportChanged.fire()
    })
    this.interfaceBundle.on('slaveInterfaceChanged', () => {
      this.interfaceChanged.fire()
    })
    this.interfaceBundle.on('bundleReloaded', () => {
      this.resourceChanged.fire()
    })
    this.interfaceBundle.on('pipelineChanged', () => {
      this.pipelineChanged.fire()
    })
    this.interfaceBundle.on('localeChanged', () => {
      this.localeChanged.fire()
    })
    await this.interfaceBundle.load()

    try {
      this.interfaceConfigJson = JSON.parse(await fs.readFile(root.configUri.fsPath, 'utf8'))
    } catch {
      this.interfaceConfigJson = {}
    }

    const fixCfg = this.fixConfig()
    if (fixCfg) {
      this.reduceConfig(fixCfg)
    } else {
      this.interfaceConfigChanged.fire()
    }
  }

  fixConfig() {
    const fixConfig: InterfaceConfig = {}

    let ctrlFixed = false
    if (typeof this.interfaceConfigJson.controller === 'object') {
      // 老版本插件使用的是对象, 兼容下
      ctrlFixed = true
      fixConfig.controller = (this.interfaceConfigJson.controller as { name: string }).name
    }

    let resFixed = false
    const prevRes = this.interfaceJson.resource?.find(
      x => x.name === this.interfaceConfigJson.resource
    )
    if (!prevRes && this.interfaceJson.resource) {
      resFixed = true
      fixConfig.resource = this.interfaceJson.resource[0].name
    }

    let taskFixed = false
    const tasks = this.interfaceConfigJson.task ?? []
    const fixedTasks = tasks.map(task => {
      const newTask = {
        ...task
      }
      if (!newTask.__key) {
        taskFixed = true
        newTask.__key = v4()
      }
      if (Array.isArray(newTask.option)) {
        const newOptions: Record<string, Record<string, string>> = {}
        for (const { name, value } of newTask.option as { name: string; value: string }[]) {
          newOptions[name] = {
            default: value
          }
        }
        taskFixed = true
        newTask.option = newOptions
      }
      return newTask
    })
    if (taskFixed) {
      fixConfig.task = fixedTasks
    }
    if (ctrlFixed || resFixed || taskFixed) {
      return fixConfig
    } else {
      return null
    }
  }

  async reduceConfig(config?: InterfaceConfig) {
    this.interfaceConfigJson = {
      ...this.interfaceConfigJson,
      ...config
    }
    this.interfaceConfigChanged.fire()

    const root = rootService.activeResource
    if (!root) {
      return
    }
    const configPath = root.configUri.fsPath
    await fs.mkdir(path.dirname(configPath), { recursive: true })
    await fs.writeFile(configPath, JSON.stringify(this.interfaceConfigJson, null, 4))
  }

  updateResource() {
    this.interfaceBundle?.switchActive(
      this.interfaceConfigJson?.controller ?? '',
      this.interfaceConfigJson?.resource ?? ''
    )
  }

  suggestResource() {
    return this.resourcePaths.length > 0 ? this.resourcePaths[this.resourcePaths.length - 1] : null
  }

  resolveRelative(uri: vscode.Uri) {
    for (const res of this.resourcePaths) {
      if (uri.fsPath.startsWith(res.fsPath)) {
        return uri.fsPath.replace(res.fsPath, '')
      }
    }
    return null
  }

  shouldFilter(uri: vscode.Uri) {
    const fileName = path.basename(uri.fsPath)
    if (fileName === 'interface.json' || fileName === 'interface.jsonc') {
      return false
    }
    const rel = this.resolveRelative(uri)
    if (rel) {
      const segs = rel.split(/[/\\]+/)
      return !!segs.find(x => x.startsWith('.'))
    }
    return true
  }

  async buildControllerRuntime(): Promise<ControllerRuntime | null> {
    if (!(await serverService.fetchConstants())) {
      return null
    }

    if (!rootService.activeResource) {
      return null
    }

    const data = this.interfaceJson
    const config = this.interfaceConfigJson
    if (!data || !config) {
      return null
    }

    const runtime = buildControllerRuntime(data, config)
    if (typeof runtime === 'string') {
      vscode.window.showErrorMessage(runtime)
      return null
    }

    return runtime
  }

  async buildRuntime(skipTask = false) {
    if (!(await serverService.fetchConstants())) {
      return '初始化失败'
    }

    if (!rootService.activeResource) {
      return '无interface'
    }
    const projectDir = vscode.Uri.joinPath(
      rootService.activeResource.workspace,
      rootService.activeResource.dirRelative
    ).fsPath

    const replaceVar = (x: string) => {
      return x.replaceAll('{PROJECT_DIR}', projectDir)
    }

    const data = this.interfaceJson
    const config = this.interfaceConfigJson

    const result: Partial<InterfaceRuntime> = {}

    result.root = projectDir

    const ctrlRt = await this.buildControllerRuntime()
    if (!ctrlRt) {
      return '构建controller失败'
    }
    result.controller = ctrlRt

    const resRt = buildResourceRuntime(data, config)
    if (typeof resRt === 'string') {
      return resRt
    }

    result.resource = resRt

    result.task = {
      tasks: []
    }
    if (!skipTask) {
      const taskRt = buildTaskRuntime(data, config, ctrlRt, resRt)
      if (typeof taskRt === 'string') {
        return taskRt
      }

      result.task = taskRt
    }

    const cfgPath = vscode.Uri.joinPath(
      rootService.activeResource.workspace,
      '.vscode',
      'mse_config.json'
    ).fsPath
    const debugSessionMapper: Record<string, string> = {}
    if (existsSync(cfgPath)) {
      const cfg = JSON.parse(await fs.readFile(cfgPath, 'utf8')) as {
        'agent.debug'?: Record<string, string>
      }
      if (cfg['agent.debug']) {
        Object.assign(debugSessionMapper, cfg['agent.debug'])
      }
    }
    if (rootService.config?.vscode?.agents) {
      Object.assign(debugSessionMapper, rootService.config.vscode.agents)
    }

    const agents: AgentConfig[] = []
    if (data.agent) {
      if (Array.isArray(data.agent)) {
        agents.push(...data.agent)
      } else {
        agents.push(data.agent)
      }
    }

    result.agent = []
    for (const agent of agents) {
      if (!agent.child_exec) {
        continue
      }

      const debug_session = debugSessionMapper[agent.child_exec]

      result.agent.push({
        child_exec: agent.child_exec ? replaceVar(agent.child_exec) : undefined,
        child_args: agent.child_args?.map(replaceVar),
        identifier: agent.identifier,

        debug_session
      })
    }

    return result as InterfaceRuntime
  }
}
