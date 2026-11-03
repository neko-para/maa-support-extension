import { createJiti } from 'jiti'
import assert from 'node:assert/strict'
import * as path from 'node:path'
import test from 'node:test'

import type { TestAgentSetting } from '../src/types/config'

const {
  DEFAULT_AGENT_CONNECT_TIMEOUT_MS,
  DEFAULT_AGENT_TIMEOUT_MS,
  buildTestAgentEnv,
  collectCustomRecognitionNames,
  formatMissingAgentError,
  formatUnregisteredAgentError,
  requiredCustomRecognitions,
  resolveTestAgents
} = await createJiti(import.meta.url, { fsCache: false }).import<
  typeof import('../src/test/agents')
>('../src/test/agents.ts')

const cwd = '/repo/project'

test('显式配置解析相对路径、默认超时并合并环境变量', () => {
  const result = resolveTestAgents({
    setting: {
      child_exec: './install/agent/cpp-algo',
      child_args: ['--flag'],
      cwd: 'install',
      env: { FOO: 'bar' }
    },
    cwd,
    baseEnv: { PI_VERSION: 'v1' }
  })
  assert.equal(result.error, undefined)
  assert.equal(result.agents.length, 1)
  const [agent] = result.agents
  assert.equal(agent.childExec, path.resolve(cwd, 'install/agent/cpp-algo'))
  assert.deepEqual(agent.childArgs, ['--flag'])
  assert.equal(agent.cwd, path.resolve(cwd, 'install'))
  assert.deepEqual(agent.env, { PI_VERSION: 'v1', FOO: 'bar' })
  assert.equal(agent.connectTimeoutMs, DEFAULT_AGENT_CONNECT_TIMEOUT_MS)
  assert.equal(agent.timeoutMs, DEFAULT_AGENT_TIMEOUT_MS)
})

test('PATH 里的裸命令保持原样，显式 cwd 以配置 cwd 解析，显式时间生效', () => {
  const result = resolveTestAgents({
    setting: [{ child_exec: 'python', connectTimeoutMs: 1000, timeoutMs: 0 }],
    cwd,
    baseEnv: {}
  })
  assert.equal(result.error, undefined)
  assert.equal(result.agents[0].childExec, 'python')
  assert.equal(result.agents[0].cwd, path.resolve(cwd))
  assert.equal(result.agents[0].connectTimeoutMs, 1000)
  assert.equal(result.agents[0].timeoutMs, 0)
})

test('{PROJECT_DIR} 按解析根展开', () => {
  const result = resolveTestAgents({
    setting: {
      child_exec: '{PROJECT_DIR}/agent/cpp-algo',
      child_args: ['--root', '{PROJECT_DIR}']
    },
    cwd,
    baseEnv: {}
  })
  assert.equal(result.error, undefined)
  assert.equal(result.agents[0].childExec, path.resolve(cwd, 'agent/cpp-algo'))
  assert.deepEqual(result.agents[0].childArgs, ['--root', path.resolve(cwd)])
})

test('默认读取 interface.json 声明，相对路径以 interface 目录解析', () => {
  const result = resolveTestAgents({
    interfaceAgents: [
      { child_exec: 'agent/go-service' },
      { child_exec: 'agent/cpp-algo', identifier: 'custom-id' }
    ],
    interfaceRoot: '/repo/assets',
    cwd,
    baseEnv: {}
  })
  assert.equal(result.error, undefined)
  assert.deepEqual(
    result.agents.map(agent => [agent.childExec, agent.cwd, agent.identifier]),
    [
      [path.resolve('/repo/assets', 'agent/go-service'), path.resolve('/repo/assets'), undefined],
      [path.resolve('/repo/assets', 'agent/cpp-algo'), path.resolve('/repo/assets'), 'custom-id']
    ]
  )
})

test('显式配置覆盖 interface；false 关闭', () => {
  const overridden = resolveTestAgents({
    setting: [{ child_exec: 'node' }],
    interfaceAgents: [{ child_exec: 'agent/go-service' }],
    interfaceRoot: '/repo/assets',
    cwd,
    baseEnv: {}
  })
  assert.deepEqual(
    overridden.agents.map(agent => agent.childExec),
    ['node']
  )

  const disabled = resolveTestAgents({
    setting: false,
    interfaceAgents: [{ child_exec: 'agent/go-service' }],
    interfaceRoot: '/repo/assets',
    cwd,
    baseEnv: {}
  })
  assert.deepEqual(disabled, { agents: [] })
})

test('无效配置返回明确错误', () => {
  assert.match(
    resolveTestAgents({ setting: [{ child_exec: '' }], cwd, baseEnv: {} }).error!,
    /test\.agent\[0\] 缺少 child_exec/
  )
  assert.match(
    resolveTestAgents({
      setting: { child_exec: 'node', child_args: [1 as unknown as string] },
      cwd,
      baseEnv: {}
    }).error!,
    /child_args 必须是字符串数组/
  )
  assert.match(
    resolveTestAgents({
      setting: { child_exec: 'node', env: { A: 1 as unknown as string } },
      cwd,
      baseEnv: {}
    }).error!,
    /env 必须是字符串到字符串的对象/
  )
  assert.match(
    resolveTestAgents({
      setting: { child_exec: 'node', connectTimeoutMs: -1 },
      cwd,
      baseEnv: {}
    }).error!,
    /connectTimeoutMs 必须是 1 到 2147483647 之间的安全整数/
  )
})

test('test.agent 为 null 时明确报错；显式 identifier 生效', () => {
  assert.match(
    resolveTestAgents({
      setting: null as unknown as TestAgentSetting,
      cwd,
      baseEnv: {}
    }).error!,
    /test\.agent 不能为 null/
  )
  const withIdentifier = resolveTestAgents({
    setting: { child_exec: 'node', identifier: 'maa-end' },
    cwd,
    baseEnv: {}
  })
  assert.equal(withIdentifier.agents[0].identifier, 'maa-end')
})

test('interface 中没有 child_exec 的声明被忽略', () => {
  const result = resolveTestAgents({
    interfaceAgents: [{}, { child_exec: 'agent/cpp-algo' }],
    interfaceRoot: '/repo/assets',
    cwd,
    baseEnv: {}
  })
  assert.equal(result.error, undefined)
  assert.deepEqual(
    result.agents.map(agent => agent.childExec),
    [path.resolve('/repo/assets', 'agent/cpp-algo')]
  )
})

test('PI 环境变量只注入客观字段，不伪造 controller / resource', () => {
  const zh = buildTestAgentEnv({
    locale: 'zh',
    maafwVersion: '5.13.0',
    interfaceVersion: 'v0.1.0'
  })
  assert.equal(zh.PI_CLIENT_NAME, 'MaaTools')
  assert.equal(zh.PI_CLIENT_LANGUAGE, 'zh_cn')
  assert.equal(zh.PI_CLIENT_MAAFW_VERSION, '5.13.0')
  assert.equal(zh.PI_INTERFACE_VERSION, 'v2.5.0')
  assert.equal(zh.PI_VERSION, 'v0.1.0')
  assert.ok(zh.PI_CLIENT_VERSION)
  assert.equal('PI_CONTROLLER' in zh, false)
  assert.equal('PI_RESOURCE' in zh, false)

  const en = buildTestAgentEnv({ locale: 'en', maafwVersion: '5.13.0' })
  assert.equal(en.PI_CLIENT_LANGUAGE, 'en_us')
  assert.equal(en.PI_VERSION, '')
})

test('从节点定义收集 custom 识别名，覆盖顶层与 And/Or 子识别', () => {
  assert.deepEqual(collectCustomRecognitionNames(null), [])
  assert.deepEqual(collectCustomRecognitionNames('not json'), [])
  assert.deepEqual(collectCustomRecognitionNames('{"recognition":"DirectHit"}'), [])
  assert.deepEqual(
    collectCustomRecognitionNames('{"recognition":"Custom","custom_recognition":"A"}'),
    ['A']
  )
  assert.deepEqual(
    collectCustomRecognitionNames(
      JSON.stringify({
        recognition: 'And',
        all_of: [
          { recognition: 'TemplateMatch' },
          { recognition: 'Custom', custom_recognition: 'B' },
          { recognition: 'Or', any_of: [{ recognition: 'Custom', custom_recognition: 'C' }] }
        ]
      })
    ),
    ['B', 'C']
  )
  // Resource.get_node_data 的有效定义是 recognition: {type, param}
  assert.deepEqual(
    collectCustomRecognitionNames(
      JSON.stringify({ recognition: { type: 'Custom', param: { custom_recognition: 'D' } } })
    ),
    ['D']
  )
  assert.deepEqual(
    collectCustomRecognitionNames(
      JSON.stringify({
        recognition: {
          type: 'And',
          param: {
            all_of: [
              'Base',
              {
                recognition: { type: 'Custom', param: { custom_recognition: 'E' } },
                sub_name: 'Custom'
              }
            ]
          }
        }
      })
    ),
    ['E']
  )
})

test('按待测节点汇总 custom 识别需求，并按名字去重节点', () => {
  const nodeData = new Map<string, string | null>([
    ['N1', '{"recognition":"Custom","custom_recognition":"A"}'],
    [
      'N2',
      JSON.stringify({
        recognition: 'And',
        all_of: [{ recognition: 'Custom', custom_recognition: 'A' }]
      })
    ],
    ['N3', '{"recognition":"TemplateMatch"}'],
    ['N4', null]
  ])
  const requirements = requiredCustomRecognitions(
    ['N1', 'N2', 'N3', 'N4'],
    node => nodeData.get(node) ?? null
  )
  assert.deepEqual(requirements, [{ name: 'A', nodes: ['N1', 'N2'] }])
})

test('缺失 agent 与未注册的报错都带节点名', () => {
  const requirements = [{ name: 'A', nodes: ['N1', 'N2'] }]
  assert.match(formatMissingAgentError(requirements), /A（节点 N1, N2）/)
  assert.match(formatUnregisteredAgentError(requirements), /agent 未注册这些 Custom 识别/)
  assert.match(formatUnregisteredAgentError(requirements), /A（节点 N1, N2）/)
})

test('And/Or 的节点名引用会递归展开出 custom 需求', () => {
  const nodeData = new Map<string, string>([
    [
      'Root',
      JSON.stringify({
        recognition: { type: 'And', param: { all_of: ['CustomNode', 'PlainNode'] } }
      })
    ],
    [
      'CustomNode',
      JSON.stringify({ recognition: { type: 'Custom', param: { custom_recognition: 'A' } } })
    ],
    ['PlainNode', JSON.stringify({ recognition: { type: 'DirectHit', param: {} } })]
  ])
  assert.deepEqual(
    requiredCustomRecognitions(['Root'], node => nodeData.get(node) ?? null),
    [{ name: 'A', nodes: ['Root'] }]
  )
})

test('节点名引用循环不会死循环', () => {
  const nodeData = new Map<string, string>([
    ['A', JSON.stringify({ recognition: { type: 'And', param: { all_of: ['B'] } } })],
    ['B', JSON.stringify({ recognition: { type: 'Or', param: { any_of: ['A'] } } })]
  ])
  assert.deepEqual(
    requiredCustomRecognitions(['A'], node => nodeData.get(node) ?? null),
    []
  )
})

test('多级引用与多个根节点都记到根节点上', () => {
  const nodeData = new Map<string, string>([
    ['Root1', JSON.stringify({ recognition: { type: 'And', param: { all_of: ['Mid'] } } })],
    ['Root2', JSON.stringify({ recognition: { type: 'Or', param: { any_of: ['Mid'] } } })],
    ['Mid', JSON.stringify({ recognition: { type: 'And', param: { all_of: ['Leaf'] } } })],
    [
      'Leaf',
      JSON.stringify({ recognition: { type: 'Custom', param: { custom_recognition: 'Deep' } } })
    ]
  ])
  assert.deepEqual(
    requiredCustomRecognitions(['Root1', 'Root2'], node => nodeData.get(node) ?? null),
    [{ name: 'Deep', nodes: ['Root1', 'Root2'] }]
  )
})

test('5.12.x 的 And/Or 内联子项平铺形状也能识别 Custom', () => {
  const nodeData = new Map<string, string>([
    [
      'Root',
      JSON.stringify({
        recognition: {
          type: 'And',
          param: {
            all_of: [{ type: 'Custom', param: { custom_recognition: 'Old' }, sub_name: 'Custom' }]
          }
        }
      })
    ]
  ])
  assert.deepEqual(
    requiredCustomRecognitions(['Root'], node => nodeData.get(node) ?? null),
    [{ name: 'Old', nodes: ['Root'] }]
  )
})

test('引用层级超过上限时明确报错而不是爆栈', () => {
  const nodeData = new Map<string, string>()
  for (let index = 0; index < 300; index += 1) {
    nodeData.set(
      `N${index}`,
      JSON.stringify({
        recognition: { type: 'And', param: { all_of: [`N${index + 1}`] } }
      })
    )
  }
  assert.throws(
    () => requiredCustomRecognitions(['N0'], node => nodeData.get(node) ?? null),
    /层级超过 256 层/
  )
})
