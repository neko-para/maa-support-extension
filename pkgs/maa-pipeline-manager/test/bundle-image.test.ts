import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import * as path from 'node:path'
import test, { after } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { Bundle } from '../src/bundle/bundle.ts'
import type { IContentLoader } from '../src/content/loader.ts'
import type { IContentWatcher, IContentWatcherController } from '../src/content/watch.ts'
import type { AbsolutePath, RelativePath } from '../src/utils/types.ts'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const cacheRoot = path.join(packageRoot, 'node_modules/.cache')

class StaticLoader implements IContentLoader {
  async get() {
    return null
  }
}

class StaticWatcher implements IContentWatcher {
  async watch(): Promise<IContentWatcherController> {
    return { stop() {} }
  }
}

const buildRoot = mkdir(cacheRoot, { recursive: true }).then(() =>
  mkdtemp(path.join(cacheRoot, 'bundle-image-test-'))
)

const BundleClass = buildRoot.then(async tempRoot => {
  const outfile = path.join(tempRoot, 'bundle.mjs')
  await build({
    absWorkingDir: packageRoot,
    entryPoints: [path.join(packageRoot, 'src/bundle/bundle.ts')],
    bundle: true,
    format: 'esm',
    logLevel: 'silent',
    outfile,
    packages: 'external',
    platform: 'node'
  })
  const module = await import(pathToFileURL(outfile).href)
  return module.Bundle as typeof Bundle
})

after(async () => {
  await rm(await buildRoot, { force: true, recursive: true })
})

test('覆盖已有模板图片同样发出 imageChanged', async () => {
  const BundleCtor = await BundleClass
  const tempRoot = await buildRoot
  const resourceRoot = path.join(tempRoot, 'resource')
  const imageFile = path.join(resourceRoot, 'image', 'template.png')
  await mkdir(path.dirname(imageFile), { recursive: true })

  const bundle = new BundleCtor(new StaticLoader(), new StaticWatcher(), false, resourceRoot)
  let changes = 0
  bundle.on('imageChanged', () => {
    changes += 1
  })
  const file = imageFile as AbsolutePath

  const added = once(bundle, 'imageChanged')
  await bundle.loadFile('image/template.png' as RelativePath, file)
  await added
  assert.equal(changes, 1, '新增图片应通知')

  // 覆盖同一路径的图片是用户在裁剪工具里「保存模板」的常规操作；
  // 识别侧缓存的是解码后的图片，不通知就会一直按旧内容匹配
  const overwritten = once(bundle, 'imageChanged')
  await bundle.loadFile('image/template.png' as RelativePath, file)
  await overwritten
  assert.equal(changes, 2, '覆盖已有图片也必须通知')
})
