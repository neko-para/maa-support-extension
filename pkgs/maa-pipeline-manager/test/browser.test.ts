import { build } from 'esbuild'
import assert from 'node:assert/strict'
import * as path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

test('logic entry bundles for a browser without Node.js polyfills', async () => {
  const result = await build({
    absWorkingDir: packageRoot,
    entryPoints: [path.join(packageRoot, 'src/logic/index.ts')],
    bundle: true,
    format: 'esm',
    logLevel: 'silent',
    platform: 'browser',
    write: false
  })

  assert.equal(result.errors.length, 0)
  assert.equal(result.outputFiles.length, 1)
  assert.ok(result.outputFiles[0].text.length > 0)
})
