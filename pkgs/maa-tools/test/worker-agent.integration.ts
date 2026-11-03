/**
 * worker 级集成测试：真实进程池 + 真实 MaaFW + 启动即退出的 fake agent。
 *
 * 不随 `pnpm test` 运行（文件名不匹配 test/*.test.ts）：
 * - 需要先 `pnpm build`（worker 入口在 dist/）
 * - 需要本机已有 MaaFW 运行时缓存（scripts 不负责下载）
 * 手动运行：`pnpm --filter @nekosu/maa-tools test:integration`
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import test from 'node:test'

const packageRoot = path.resolve(import.meta.dirname, '..')
const distIndex = path.join(packageRoot, 'dist', 'index.mjs')
const distWorker = path.join(packageRoot, 'dist', 'test', 'worker.mjs')
const bin = path.join(packageRoot, 'bin', 'maa-tools')
const fixtureAgent = path.join(packageRoot, 'test', 'fixtures', 'agent-exit.mjs')

async function installedMaafwVersion() {
  const pkg = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8')) as {
    devDependencies?: Record<string, string>
  }
  const fallback = pkg.devDependencies?.['@maaxyz/maa-node']
  if (!fallback) {
    return undefined
  }
  const modulePath = path.join(
    os.homedir(),
    '.maa-tools',
    'install',
    fallback,
    'node_modules',
    '@maaxyz',
    'maa-node',
    'dist',
    'index-client.js'
  )
  return existsSync(modulePath) ? fallback : undefined
}

const emptyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=',
  'base64'
)

test('启动即退出的 agent 在握手期快速失败并带上退出码', async t => {
  if (!existsSync(distIndex) || !existsSync(distWorker)) {
    t.skip('缺少 dist 构建，先运行 pnpm build')
    return
  }
  const maaVersion = await installedMaafwVersion()
  if (!maaVersion) {
    t.skip('本机没有对应版本的 MaaFW 缓存，跳过 worker 级集成测试')
    return
  }

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maa-tools-agent-exit-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const testFile = path.join(root, 'tests', 'test_demo.json')
  await fs.mkdir(path.join(root, 'resource', 'pipeline'), { recursive: true })
  await fs.mkdir(path.join(root, 'images'), { recursive: true })
  await fs.mkdir(path.join(root, 'tests'), { recursive: true })
  await fs.writeFile(path.join(root, 'images', 'img.png'), emptyPng)
  await fs.writeFile(
    path.join(root, 'interface.json'),
    JSON.stringify(
      {
        interface_version: 2,
        name: 'agent-exit',
        version: 'v0.0.1',
        controller: [{ name: 'Fake', type: 'Win32' }],
        resource: [{ name: 'Res', path: ['./resource'] }],
        agent: { child_exec: process.execPath, child_args: [fixtureAgent] }
      },
      null,
      4
    )
  )
  await fs.writeFile(
    path.join(root, 'resource', 'pipeline', 'main.json'),
    JSON.stringify({
      CustomNode: { recognition: 'Custom', custom_recognition: 'NeverRegistered' }
    })
  )
  await fs.writeFile(
    testFile,
    JSON.stringify({
      configs: { controller: 'Fake', resource: 'Res', imageRoot: 'images' },
      cases: [{ image: 'img.png', hits: ['CustomNode'] }]
    })
  )
  const configPath = path.join(root, 'maa.config.mts')
  await fs.writeFile(
    configPath,
    `export default ${JSON.stringify(
      {
        cwd: root,
        maaVersion,
        maaLogDir: 'debug',
        interfacePath: 'interface.json',
        test: {
          cases: [
            {
              configs: { controller: 'Fake', resource: 'Res', imageRoot: 'images' },
              nodes: ['CustomNode'],
              cases: [
                {
                  origin: { file: testFile, case: 0 },
                  image: 'img.png',
                  hits: ['CustomNode']
                }
              ]
            }
          ]
        }
      },
      null,
      2
    )}\n`
  )

  const startedAt = performance.now()
  const result = spawnSync(process.execPath, [bin, 'test', configPath, '--json'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 25_000,
    windowsHide: true
  })
  const elapsed = performance.now() - startedAt
  assert.equal(result.error, undefined, String(result.error))
  assert.equal(result.status, 1, result.stdout + result.stderr)
  const report = JSON.parse(result.stdout) as {
    status?: string
    errorCode?: string
    reason?: string
    durationMs?: number
  }
  assert.equal(report.status, 'error')
  assert.equal(report.errorCode, 'test-agent-failed')
  assert.match(report.reason ?? '', /exitCode=3/)
  // 旧行为会等满默认 30s 的 connectTimeout；这里要求明显早于它。
  assert.ok(elapsed < 20_000, `耗时 ${Math.round(elapsed)}ms，疑似又等满了 connectTimeout`)
  assert.ok((report.durationMs ?? 0) < 20_000)
})
