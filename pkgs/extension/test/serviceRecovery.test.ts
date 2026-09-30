import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import test from 'node:test'

// 这些服务依赖 vscode 模块，无法在测试进程中导入，因此按源码约定断言（与 process.test.ts 一致）。
const read = (rel: string) => fs.readFile(new URL(rel, import.meta.url), 'utf8')

const agentSource = await read('../src/service/agent.ts')
const serverSource = await read('../src/service/server.ts')
const launchSource = await read('../src/service/launch.ts')
const rpcSource = await read('../src/service/utils/rpc.ts')
const maaServerMaaSource = await read('../../maa-server/src/maa.ts')

test('IPC dispatcher 收口 handler 的异步拒绝', () => {
  // maa-server 侧同一约定由 pkgs/maa-server/test/ipc.test.ts 行为级验证
  assert.match(serverSource, /Promise\.resolve\(\)\s*\.then\(/, 'dispatcher 未接住异步拒绝')
  assert.match(serverSource, /\.catch\(err => \{/, 'dispatcher 未记录 handler 失败')
})

test('清理类 IPC 调用不再产生未捕获拒绝', () => {
  // 除 stopAgentSilently 自身外，不得存在裸的 ipc.stopAgent(...) 调用
  assert.equal((maaServerMaaSource.match(/ipc\.stopAgent\(/g) ?? []).length, 1)
  assert.match(maaServerMaaSource, /function stopAgentSilently\(id: string\)/)
  assert.match(maaServerMaaSource, /\.catch\(err => \{\s*\n\s*logger\.warn\(`stopAgent/)

  // 两个 tasker sink 的 pushNotify 都必须接住拒绝
  assert.equal(
    (
      maaServerMaaSource.match(/await ipc\.pushNotify\(handle, msg\)\n\s*\} catch \(err\) \{/g) ??
      []
    ).length,
    2
  )
})

test('调试会话终止后摘除残留 agent 记录', () => {
  assert.match(agentSource, /this\.reapDebugSession\(event\)/)
  assert.match(agentSource, /private reapDebugSession\(session: vscode\.DebugSession\)/)
  assert.match(agentSource, /info\.session\.id === session\.id/)
})

test('stopAgent 与 agentStopped 失败降级为日志', () => {
  assert.match(agentSource, /logger\.warn\(`stop agent \$\{id\} failed: \$\{err\}`\)/)
  assert.match(agentSource, /logger\.warn\(`notify agentStopped \$\{id\} failed: \$\{err\}`\)/)
})

test('setupInstance 失败后重建 maa-server 并重试一次', () => {
  assert.match(launchSource, /private async setupInstanceOnce/)
  assert.equal((launchSource.match(/this\.setupInstanceOnce\(runtime\)/g) ?? []).length, 2)
  assert.match(launchSource, /logger\.warn\(`setup instance failed: \$\{first\[1\]\}/)
  assert.match(launchSource, /serverService\.kill\(\)/)
})

test('RpcManager.kill 同步清空连接，重建后可立即重连', () => {
  assert.match(rpcSource, /this\.conn = undefined/)
})
