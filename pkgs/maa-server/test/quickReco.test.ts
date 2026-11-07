import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import test, { after } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { AgentRuntime } from '@nekosu/maa-pipeline-manager'
import type { ToolAgentSetup, ToolResult } from '@nekosu/maa-server-proto'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

// 源码依赖无扩展名的相对导入，node 无法直接加载；三个入口打进同一个 bundle 才能共享模块状态
const bundleDir = await mkdtemp(path.join(os.tmpdir(), 'maa-server-quick-reco-'))
const bundleFile = path.join(bundleDir, 'quickReco.mjs')
const bundleResult = await build({
  absWorkingDir: packageRoot,
  banner: {
    // vscode-jsonrpc 等 CommonJS 依赖内部使用 require()，ESM 输出需要提供它
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"
  },
  stdin: {
    contents: [
      "export { performReco } from './src/tools/reco'",
      "export { destroyAgent, startAgent } from './src/agent'",
      "export { setupIpc } from './src/apis'"
    ].join('\n'),
    resolveDir: packageRoot,
    loader: 'ts',
    sourcefile: 'quickRecoEntry.ts'
  },
  bundle: true,
  format: 'esm',
  logLevel: 'silent',
  outfile: bundleFile,
  platform: 'node',
  target: 'node24'
})
assert.equal(bundleResult.errors.length, 0)

type AgentInfo = { agent: string; identifier?: string }

const mod = (await import(pathToFileURL(bundleFile).href)) as {
  performReco: (
    image: string,
    resources: string[],
    agent?: ToolAgentSetup
  ) => Promise<ToolResult | null>
  startAgent: (
    config: AgentRuntime,
    context: { root: string; resources: string[]; timeout: number },
    resource: unknown
  ) => Promise<AgentInfo | null>
  destroyAgent: (info: AgentInfo) => void
  setupIpc: (conn: unknown) => void
}
after(() => {
  rmSync(bundleDir, { recursive: true, force: true })
})

const nodes: Record<string, string> = {
  NeedsX: JSON.stringify({ recognition: { type: 'Custom', param: { custom_recognition: 'X' } } }),
  NeedsY: JSON.stringify({ recognition: { type: 'Custom', param: { custom_recognition: 'Y' } } })
}

const events: string[] = []

type ActionSelf = {
  context: { run_recognition: (task: string) => Promise<Record<string, unknown>> }
}

// 假 agent 只注册了 X
class FakeClient {
  identifier: string
  connected = false
  alive = true
  timeout = ''

  constructor(identifier?: string) {
    this.identifier = identifier ?? 'generated'
  }

  bind_resource() {}
  async connect() {
    this.connected = true
  }
  get custom_recognition_list() {
    return ['X']
  }
  destroy() {}
}

class FakeResource {
  loaded = false
  actions: Record<string, (self: ActionSelf) => Promise<boolean>> = {}

  add_sink() {}
  post_bundle() {
    return {
      wait: async () => {
        this.loaded = true
      }
    }
  }
  register_custom_action(name: string, action: (self: ActionSelf) => Promise<boolean>) {
    this.actions[name] = action
  }
  get node_list() {
    return Object.keys(nodes)
  }
  get_node_data(name: string) {
    return nodes[name] ?? null
  }
  destroy() {}
}

class FakeController {
  connected = false
  screenshot_use_raw_size = false

  post_connection() {
    return {
      wait: async () => {
        this.connected = true
      }
    }
  }
  destroy() {}
}

class FakeTasker {
  inited = true
  controller: unknown
  resource: FakeResource | undefined

  post_task() {
    const resource = this.resource!
    return {
      wait: async () => {
        await resource.actions['@mse/action']!({
          context: {
            run_recognition: async task => ({ name: task, hit: true, box: [0, 0, 1, 1] })
          }
        })
      }
    }
  }
  destroy() {}
}

Object.defineProperty(globalThis, 'maa', {
  configurable: true,
  writable: true,
  value: {
    Client: FakeClient,
    CustomController: FakeController,
    Resource: FakeResource,
    Tasker: FakeTasker
  }
})

const picks: string[] = []
let agentSeq = 0
const host: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  quickPick: async () => picks.shift() ?? null,
  startTask: async () => {
    agentSeq += 1
    events.push(`startTask agent-${agentSeq}`)
    return `agent-${agentSeq}`
  },
  startDebugSession: async () => null,
  stopAgent: async id => {
    events.push(`stopAgent ${id}`)
  }
}

mod.setupIpc({
  onRequest: () => ({ dispose() {} }),
  sendRequest: (_type: unknown, method: string, args: unknown[]) => host[method]!(...args)
})

const agentConfig: AgentRuntime = {
  child_exec: 'python',
  child_args: ['agent.py'],
  identifier: 'MyAgent'
}
const agentSetup: ToolAgentSetup = {
  root: path.join(os.tmpdir(), 'quick-reco-project'),
  resources: ['resource'],
  agents: [agentConfig],
  timeout: 1000
}

function startedAgents() {
  return events.filter(event => event.startsWith('startTask')).length
}

test('会话里的 agent 未注册所需识别名时直接返回未注册，不重复启动 agent', async () => {
  events.length = 0

  picks.push('NeedsX')
  const first = await mod.performReco('', ['resource'], agentSetup)
  assert.equal(first?.failure, undefined)
  assert.equal((JSON.parse(first!.detail!) as { name: string }).name, 'NeedsX')

  picks.push('NeedsY')
  const second = await mod.performReco('', ['resource'], agentSetup)
  assert.deepEqual(second?.failure, { kind: 'unregistered', names: ['Y'] })
  assert.equal(startedAgents(), 1)
  assert.ok(events.includes('stopAgent agent-1'), '作废会话时结束已启动的 agent')
})

test('正式实例占用同名 identifier 时快速识别不启动第二个 agent', async () => {
  events.length = 0

  const formal = await mod.startAgent(
    agentConfig,
    { root: agentSetup.root, resources: agentSetup.resources, timeout: 1000 },
    new FakeResource()
  )
  assert.ok(formal)

  picks.push('NeedsX')
  const blocked = await mod.performReco('', ['resource'], agentSetup)
  assert.deepEqual(blocked?.failure, { kind: 'agent-in-use', identifiers: ['MyAgent'] })
  assert.equal(startedAgents(), 1, '只有正式实例启动过 agent')

  mod.destroyAgent(formal)
  picks.push('NeedsX')
  const allowed = await mod.performReco('', ['resource'], agentSetup)
  assert.equal(allowed?.failure, undefined)
  assert.equal(startedAgents(), 2)
})
