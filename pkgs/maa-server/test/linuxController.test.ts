import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import test, { after } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  type ControllerRuntime,
  type Interface,
  type InterfaceConfig,
  buildControllerRuntime
} from '@nekosu/maa-pipeline-manager/logic'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

// maa.ts 依赖无扩展名的相对导入，node 无法直接加载，因此先打包再导入
const bundleDir = await mkdtemp(path.join(os.tmpdir(), 'maa-server-linux-controller-'))
const bundleFile = path.join(bundleDir, 'maa.mjs')
const bundleResult = await build({
  absWorkingDir: packageRoot,
  banner: {
    // vscode-jsonrpc 等 CommonJS 依赖内部使用 require()，ESM 输出需要提供它
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"
  },
  entryPoints: [path.join(packageRoot, 'src/maa.ts')],
  bundle: true,
  format: 'esm',
  logLevel: 'silent',
  outfile: bundleFile,
  platform: 'node',
  target: 'node24'
})
assert.equal(bundleResult.errors.length, 0)
const { updateCtrl } = (await import(pathToFileURL(bundleFile).href)) as {
  updateCtrl: (runtime: ControllerRuntime) => Promise<boolean>
}
after(() => {
  rmSync(bundleDir, { recursive: true, force: true })
})

type GamescopeInstance = [display_no: number, pipewire_node_id: number, eis_socket_path: string]

type FakeMaaOptions = {
  instances?: GamescopeInstance[]
  // false 模拟早于 5.13.0-beta.3 的 MaaFramework：缺少 LinuxController / find_gamescope_instances
  supported?: boolean
}

// updateCtrl 在调用时读取 globalThis.maa，因此可以注入假的 MaaFramework 绑定
function setupFakeMaa({ instances = [], supported = true }: FakeMaaOptions = {}) {
  const createdConfigs: Record<string, unknown>[] = []
  let findCalls = 0

  class LinuxController {
    static async find_gamescope_instances() {
      findCalls += 1
      return instances
    }

    connected = true

    constructor(config: string) {
      createdConfigs.push(JSON.parse(config) as Record<string, unknown>)
    }

    add_sink(_callback: unknown) {}
    post_connection() {
      return { wait: async () => {} }
    }
    destroy() {}
  }

  const fakeMaa = supported
    ? {
        LinuxScreencapMethod: { Wlr: '1', ExtImage: '2', PipeWire: '4' },
        LinuxInputMethod: { Wlr: '1', UInput: '2', Libei: '4' },
        LinuxController
      }
    : {}

  Object.defineProperty(globalThis, 'maa', {
    configurable: true,
    writable: true,
    value: fakeMaa
  })

  return {
    createdConfigs,
    get findCalls() {
      return findCalls
    }
  }
}

function linuxRuntime(name: string, conf: Record<string, unknown>): ControllerRuntime {
  return {
    name,
    type: 'linux',
    args: [JSON.stringify(conf)]
  }
}

// 平台守卫（process.platform !== 'linux' 时 Linux 控制器直接失败）只在 Linux 上放行，
// 因此成功路径的用例需要临时把 platform 换成 linux。只能包住 updateCtrl 调用，不能
// 在模块顶层 stub：esbuild 会按假平台去找 @esbuild/<platform>-<arch>，导致整个文件加载失败。
async function withPlatform<T>(platform: NodeJS.Platform, fn: () => Promise<T>): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')
  assert.ok(descriptor)
  Object.defineProperty(process, 'platform', { configurable: true, value: platform })
  try {
    return await fn()
  } finally {
    Object.defineProperty(process, 'platform', descriptor)
  }
}

test('linux controller injects the gamescope instance selected by display_no', async () => {
  const fake = setupFakeMaa({
    instances: [
      [0, 11, '/run/user/1000/gamescope-0-ei'],
      [2, 22, '/run/user/1000/gamescope-2-ei']
    ]
  })

  const ok = await withPlatform('linux', () =>
    updateCtrl(
      linuxRuntime('select-by-display-no', {
        screencap_method: 4,
        input_method: 4,
        pipewire_source: 'Gamescope',
        display_no: 2
      })
    )
  )

  assert.equal(ok, true)
  assert.equal(fake.createdConfigs.length, 1)
  assert.equal(fake.createdConfigs[0].pw_node_id, 22)
  assert.equal(fake.createdConfigs[0].eis_socket_path, '/run/user/1000/gamescope-2-ei')
  // client-only 标记字段不应传给原生层
  assert.equal('display_no' in fake.createdConfigs[0], false)
  assert.equal('pipewire_source' in fake.createdConfigs[0], false)
})

test('linux controller skips an instance whose display has no PipeWire node', async () => {
  const fake = setupFakeMaa({
    instances: [
      [0, 0, '/run/user/1000/gamescope-0-ei'],
      [2, 33, '/run/user/1000/gamescope-2-ei']
    ]
  })

  const ok = await withPlatform('linux', () =>
    updateCtrl(
      linuxRuntime('skip-empty-node', { screencap_method: 4, input_method: 1, display_no: 0 })
    )
  )

  assert.equal(ok, true)
  assert.equal(fake.createdConfigs[0].pw_node_id, 33)
})

test('linux controller falls back to the first instance with a PipeWire node', async () => {
  const fake = setupFakeMaa({
    instances: [
      [0, 0, '/run/user/1000/gamescope-0-ei'],
      [1, 44, '/run/user/1000/gamescope-1-ei']
    ]
  })

  const ok = await withPlatform('linux', () =>
    updateCtrl(linuxRuntime('fallback-instance', { screencap_method: 1, input_method: 4 }))
  )

  assert.equal(ok, true)
  assert.equal(fake.createdConfigs[0].pw_node_id, 44)
  assert.equal(fake.createdConfigs[0].eis_socket_path, '/run/user/1000/gamescope-1-ei')
})

test('linux controller rejects the Portal PipeWire source', async () => {
  const fake = setupFakeMaa({ instances: [[0, 11, '/run/user/1000/gamescope-0-ei']] })

  const ok = await withPlatform('linux', () =>
    updateCtrl(
      linuxRuntime('reject-portal', {
        screencap_method: 4,
        input_method: 1,
        pipewire_source: 'Portal'
      })
    )
  )

  assert.equal(ok, false)
  assert.equal(fake.createdConfigs.length, 0)
  assert.equal(fake.findCalls, 0)
})

test('linux controller fails cleanly when the active MaaFramework is too old', async () => {
  const fake = setupFakeMaa({ supported: false })

  const ok = await withPlatform('linux', () =>
    updateCtrl(
      linuxRuntime('old-framework', { screencap_method: 4, input_method: 4, display_no: 0 })
    )
  )

  assert.equal(ok, false)
  assert.equal(fake.createdConfigs.length, 0)
})

// 客户端 buildControllerRuntime 产出的 runtime 必须能被服务端直接消费：binding 导出的
// Linux 常量是字符串（如 "4"），配置 JSON 中必须是数字，否则原生创建控制器会失败
test('linux runtime built by the client stays numeric and is accepted by the server', async () => {
  const fake = setupFakeMaa({ instances: [[0, 11, '/run/user/1000/gamescope-0-ei']] })

  const data: Interface = {
    controller: [
      {
        name: 'client-built-linux',
        type: 'Linux',
        linux: { screencap: 'PipeWire', input: 'Libei' }
      }
    ]
  }
  const config: InterfaceConfig = {
    controller: 'client-built-linux',
    linux: { display_no: 0 }
  }

  // 只传两个参数：与运行时一致，常量取自 globalThis.maa
  const runtime = buildControllerRuntime(data, config)
  if (typeof runtime === 'string' || runtime.type !== 'linux') {
    assert.fail(`unexpected controller runtime ${JSON.stringify(runtime)}`)
  }

  const conf = JSON.parse(runtime.args[0]) as Record<string, unknown>
  assert.equal(conf.screencap_method, 4)
  assert.equal(conf.input_method, 4)
  assert.equal(conf.pipewire_source, 'Gamescope')
  assert.equal(conf.display_no, 0)

  assert.equal(await withPlatform('linux', () => updateCtrl(runtime)), true)
  assert.equal(fake.createdConfigs.length, 1)
  assert.equal(fake.createdConfigs[0].screencap_method, 4)
  assert.equal(fake.createdConfigs[0].pw_node_id, 11)
  assert.equal(fake.createdConfigs[0].eis_socket_path, '/run/user/1000/gamescope-0-ei')
})

test('linux controller fails cleanly on non-Linux platforms', async () => {
  const fake = setupFakeMaa({ instances: [[0, 11, '/run/user/1000/gamescope-0-ei']] })

  // 非 Linux 平台上 binding 的构造函数会抛 TypeError，这里直接返回失败
  const ok = await withPlatform('win32', () =>
    updateCtrl(
      linuxRuntime('non-linux-platform', { screencap_method: 4, input_method: 4, display_no: 0 })
    )
  )

  assert.equal(ok, false)
  assert.equal(fake.createdConfigs.length, 0)
  assert.equal(fake.findCalls, 0)
})

test('linux controller does not query gamescope for Wlr screencap and input', async () => {
  const fake = setupFakeMaa({ instances: [[0, 11, '/run/user/1000/gamescope-0-ei']] })

  const ok = await withPlatform('linux', () =>
    updateCtrl(
      linuxRuntime('wlr-only', {
        screencap_method: 1,
        input_method: 1,
        wlr_socket_path: '/run/wayland-0'
      })
    )
  )

  assert.equal(ok, true)
  assert.equal(fake.findCalls, 0)
  assert.equal('pw_node_id' in fake.createdConfigs[0], false)
})
