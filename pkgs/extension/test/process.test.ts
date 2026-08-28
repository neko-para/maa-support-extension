import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { PassThrough } from 'node:stream'
import test from 'node:test'

import { makePromise, waitForConnection } from '../src/service/utils/promise.ts'

const processSource = await fs.readFile(
  new URL('../src/service/utils/process.ts', import.meta.url),
  'utf8'
)

test('UAC wrapper uses a trusted cmd.exe path and writes a UTF-8 BOM', () => {
  assert.match(processSource, /Join-Path \(\[Environment\]::SystemDirectory\) 'cmd\.exe'/)
  assert.doesNotMatch(processSource, /\$env:ComSpec/)
  assert.match(processSource, /Buffer\.from\(\[0xef, 0xbb, 0xbf\]\)/)
})

test('ProcessManager enables stateful UTF-8 decoding for stdout and stderr', () => {
  assert.match(processSource, /for \(const stream of \[proc\.stdout, proc\.stderr\]\)/)
  assert.match(processSource, /stream\?\.setEncoding\('utf8'\)/)
  assert.doesNotMatch(processSource, /data\.toString\(\)/)

  const stream = new PassThrough()
  const output: string[] = []
  stream.setEncoding('utf8')
  stream.on('data', chunk => output.push(chunk))

  const encoded = Buffer.from('中文日志', 'utf8')
  stream.write(encoded.subarray(0, 1))
  stream.end(encoded.subarray(1))

  assert.equal(output.join(''), '中文日志')
})

test('RPC connection wait succeeds only after protocol setup', async () => {
  const [connection, resolveConnection] = makePromise<boolean>()
  const [processClosed] = makePromise<void>()

  setImmediate(() => resolveConnection(true))

  assert.equal(await waitForConnection(connection, processClosed, 1_000), 'connected')
})

test('RPC connection wait ends on process exit, rejection, or timeout', async t => {
  await t.test('process exit', async () => {
    const [connection] = makePromise<boolean>()
    const [processClosed, resolveProcessClosed] = makePromise<void>()
    setImmediate(resolveProcessClosed)
    assert.equal(await waitForConnection(connection, processClosed, 1_000), 'process-exited')
  })

  await t.test('connection rejection', async () => {
    const [processClosed] = makePromise<void>()
    assert.equal(await waitForConnection(Promise.resolve(false), processClosed, 1_000), 'failed')
  })

  await t.test('timeout', async () => {
    const [connection] = makePromise<boolean>()
    const [processClosed] = makePromise<void>()
    assert.equal(await waitForConnection(connection, processClosed, 10), 'timeout')
  })
})

test(
  'Windows PowerShell 5.1 reads non-ASCII content from a BOM script and emits UTF-8',
  { skip: process.platform !== 'win32' },
  async () => {
    const tempFolder = await fs.mkdtemp(path.join(os.tmpdir(), 'mse-process-test-'))
    const scriptPath = path.join(tempFolder, '编码测试.ps1')
    const script = [
      '$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)',
      "$target = 'C:\\测试目录\\maa-server.mjs'",
      'Write-Output $target',
      "Write-Error '中文日志'"
    ].join('\n')

    try {
      await fs.writeFile(
        scriptPath,
        Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(script, 'utf8')])
      )
      const result = spawnSync('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath
      ])
      const output = `${result.stdout.toString('utf8')}\n${result.stderr.toString('utf8')}`

      assert.equal(result.error, undefined)
      assert.match(output, /C:\\测试目录\\maa-server\.mjs/)
      assert.match(output, /中文日志/)
      assert.doesNotMatch(output, /�/)
    } finally {
      await fs.rm(tempFolder, { recursive: true, force: true })
    }
  }
)
