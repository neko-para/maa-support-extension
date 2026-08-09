import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import * as path from 'node:path'
import test, { after } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { IContentLoader } from '../src/content/loader'
import type { IContentWatcher, IContentWatcherController } from '../src/content/watch'
import type { InterfaceBundle } from '../src/interface/interface'
import type { ParserConfig, StringNode } from '../src/parser/utils'
import type { TaskName } from '../src/utils/types'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const cacheRoot = path.join(packageRoot, 'node_modules/.cache')

class StaticLoader implements IContentLoader {
  readonly files: Record<string, string>

  constructor(files: Record<string, string>) {
    this.files = files
  }

  async get(file: string) {
    return this.files[file] ?? null
  }
}

class StaticWatcher implements IContentWatcher {
  async watch(): Promise<IContentWatcherController> {
    return { stop() {} }
  }
}

const buildRoot = mkdir(cacheRoot, { recursive: true }).then(() =>
  mkdtemp(path.join(cacheRoot, 'custom-parser-test-'))
)

const InterfaceBundleClass = buildRoot.then(async tempRoot => {
  const outfile = path.join(tempRoot, 'interface.mjs')
  await build({
    absWorkingDir: packageRoot,
    entryPoints: [path.join(packageRoot, 'src/interface/interface.ts')],
    bundle: true,
    format: 'esm',
    logLevel: 'silent',
    outfile,
    packages: 'external',
    platform: 'node'
  })
  const module = await import(pathToFileURL(outfile).href)
  return module.InterfaceBundle as typeof InterfaceBundle
})

after(async () => {
  await rm(await buildRoot, { force: true, recursive: true })
})

function findString(
  param: Parameters<NonNullable<ParserConfig['customReco']>>[1],
  key: string,
  utils: Parameters<NonNullable<ParserConfig['customReco']>>[2]
): StringNode | undefined {
  for (const [name, value] of utils.parseObject(param)) {
    if (name === key && utils.isString(value)) {
      return value
    }
  }
  return undefined
}

function createParser() {
  const calls: { customName: string; file: string }[] = []
  const parser: ParserConfig = {
    customReco(customName, param, utils) {
      calls.push({ customName, file: this.file })
      const node = findString(param, 'task', utils)
      return node ? [{ type: 'taskRef', node, missingPolicy: 'error' }] : []
    },
    customAction(customName, param, utils) {
      calls.push({ customName, file: this.file })
      const node = findString(param, 'template', utils)
      return node ? [{ type: 'template', node, missingPolicy: 'warning' }] : []
    }
  }
  return { calls, parser }
}

function interfaceWithOverride() {
  return JSON.stringify({
    task: [
      {
        name: 'Feature',
        entry: 'OverrideTask',
        pipeline_override: {
          OverrideTask: {
            next: 'StandardTask',
            recognition: 'Custom',
            custom_recognition: 'test.reco',
            custom_recognition_param: { task: 'CustomTask' },
            action: 'Custom',
            custom_action: 'test.action',
            custom_action_param: { template: 'custom.png' }
          }
        }
      }
    ]
  })
}

function assertOverrideRefs(bundle: InterfaceBundle, expectedFile: string) {
  const task = bundle.info.layer.tasks['OverrideTask' as TaskName]?.[0]
  assert.ok(task)
  assert.equal(task.file, expectedFile)
  assert.deepEqual(
    task.info.refs.map(ref => ({ type: ref.type, target: 'target' in ref ? ref.target : null })),
    [
      { type: 'task.next', target: 'StandardTask' },
      { type: 'task.custom_task', target: 'CustomTask' },
      { type: 'task.custom_template', target: 'custom.png' }
    ]
  )
}

test('custom parsers receive pipeline overrides from the main interface', async () => {
  const root = path.resolve(packageRoot, 'test-project')
  const interfaceFile = path.join(root, 'interface.json')
  const { calls, parser } = createParser()
  const Bundle = await InterfaceBundleClass
  const bundle = new Bundle(
    new StaticLoader({ [interfaceFile]: interfaceWithOverride() }),
    new StaticWatcher(),
    false,
    root,
    'interface.json',
    parser
  )

  try {
    await bundle.load()

    assertOverrideRefs(bundle, interfaceFile)
    assert.deepEqual(calls, [
      { customName: 'test.reco', file: interfaceFile },
      { customName: 'test.action', file: interfaceFile }
    ])
  } finally {
    bundle.stop()
  }
})

test('custom parsers receive pipeline overrides from imported interfaces', async () => {
  const root = path.resolve(packageRoot, 'test-project')
  const interfaceFile = path.join(root, 'interface.json')
  const importedFile = path.join(root, 'imported.json')
  const { calls, parser } = createParser()
  const Bundle = await InterfaceBundleClass
  const bundle = new Bundle(
    new StaticLoader({
      [interfaceFile]: JSON.stringify({ import: ['imported.json'] }),
      [importedFile]: interfaceWithOverride()
    }),
    new StaticWatcher(),
    false,
    root,
    'interface.json',
    parser
  )
  const imported = new Promise<void>(resolve => {
    bundle.once('slaveInterfaceChanged', resolve)
  })

  try {
    await bundle.load()
    await imported

    assertOverrideRefs(bundle, importedFile)
    assert.deepEqual(calls, [
      { customName: 'test.reco', file: importedFile },
      { customName: 'test.action', file: importedFile }
    ])
  } finally {
    bundle.stop()
  }
})
