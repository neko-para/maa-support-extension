import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

// apis.ts 依赖无扩展名的相对导入，node 无法直接加载，因此先打包再导入
const bundleDir = await mkdtemp(path.join(os.tmpdir(), 'maa-server-ipc-'))
const bundleFile = path.join(bundleDir, 'apis.mjs')
const bundleResult = await build({
  absWorkingDir: packageRoot,
  banner: {
    // vscode-jsonrpc 等 CommonJS 依赖内部使用 require()，ESM 输出需要提供它
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"
  },
  entryPoints: [path.join(packageRoot, 'src/apis.ts')],
  bundle: true,
  format: 'esm',
  logLevel: 'silent',
  outfile: bundleFile,
  platform: 'node',
  target: 'node24'
})
assert.equal(bundleResult.errors.length, 0)

// ipc 是 export let，setupIpc 时才被赋值：这里保留命名空间对象按 live binding 读取
const apis = (await import(pathToFileURL(bundleFile).href)) as {
  ipc: { $: Record<string, (...args: unknown[]) => unknown> }
  setupIpc: (conn: unknown) => void
}

let dispatch: ((method: string, args: unknown[]) => unknown) | undefined

test('hostToSubReq dispatcher 把 handler 拒绝收口成响应而不是 ResponseError', async () => {
  apis.setupIpc({
    onRequest: (_type: unknown, cb: (method: string, args: unknown[]) => unknown) => {
      dispatch = cb
      return { dispose() {} }
    }
  })

  apis.ipc.$['async-boom'] = async () => {
    throw new Error('async boom')
  }
  apis.ipc.$['sync-boom'] = () => {
    throw new Error('sync boom')
  }
  apis.ipc.$['ok'] = async () => 'value'

  // 未接住的拒绝会以 ResponseError 回送，成为 extension 侧的未捕获拒绝；
  // 收口后调用方拿到的是成功响应（null）
  assert.equal(await dispatch!('async-boom', []), null)
  assert.equal(await dispatch!('sync-boom', []), null)
  assert.equal(await dispatch!('ok', []), 'value')
})
