import { createJiti } from 'jiti'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

const { AgentHandshakeError, raceAgentHandshake } = await createJiti(import.meta.url, {
  fsCache: false
}).import<typeof import('../src/test/agent-handshake')>('../src/test/agent-handshake.ts')

function fakeChild(exitCode: number | null = null) {
  const emitter = new EventEmitter() as EventEmitter & {
    exitCode: number | null
    signalCode: NodeJS.Signals | null
  }
  emitter.exitCode = exitCode
  emitter.signalCode = null
  return emitter
}

const tick = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

test('握手期间子进程退出时立刻失败，不等 connectTimeout', async () => {
  const child = fakeChild()
  let resolveConnect: (() => void) | undefined = undefined
  const connect = new Promise<void>(resolve => {
    resolveConnect = resolve
  })
  const stranded: Promise<unknown>[] = []
  const startedAt = performance.now()
  const pending = raceAgentHandshake(connect, child, {
    onStranded: settled => {
      stranded.push(settled)
    }
  })
  await tick(5)
  child.emit('exit', 3, null)
  await assert.rejects(pending, (error: unknown) => {
    assert.ok(error instanceof AgentHandshakeError)
    assert.equal(error.connectSettled, false)
    return true
  })
  assert.ok(performance.now() - startedAt < 1_000)
  assert.equal(stranded.length, 1)
  // connect 仍在执行：延迟销毁要等它 settle 之后才回调。
  let destroyed = false
  stranded[0].finally(() => {
    destroyed = true
  })
  await tick(5)
  assert.equal(destroyed, false)
  resolveConnect!()
  await tick(5)
  assert.equal(destroyed, true)
})

test('调用前子进程已退出时立刻失败', async () => {
  const child = fakeChild(3)
  const stranded: Promise<unknown>[] = []
  let resolveConnect: (() => void) | undefined = undefined
  const connect = new Promise<void>(resolve => {
    resolveConnect = resolve
  })
  await assert.rejects(
    raceAgentHandshake(connect, child, {
      onStranded: settled => {
        stranded.push(settled)
      }
    }),
    AgentHandshakeError
  )
  assert.equal(stranded.length, 1)
  resolveConnect!()
})

test('connect 先成功时正常返回，之后退出不再影响结果', async () => {
  const child = fakeChild()
  const stranded: Promise<unknown>[] = []
  const pending = raceAgentHandshake(Promise.resolve('ok'), child, {
    onStranded: settled => {
      stranded.push(settled)
    }
  })
  await pending
  child.emit('exit', 0, null)
  await tick(5)
  assert.equal(stranded.length, 0)
})

test('connect 先失败时原样抛出，不当作握手退出', async () => {
  const child = fakeChild()
  const stranded: Promise<unknown>[] = []
  const failure = new Error('connect failed')
  await assert.rejects(
    raceAgentHandshake(Promise.reject(failure), child, {
      onStranded: settled => {
        stranded.push(settled)
      }
    }),
    error => error === failure
  )
  assert.equal(stranded.length, 0)
})
