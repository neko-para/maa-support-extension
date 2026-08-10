import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import config from '../tsdown.config.mts'

test('bundles every runtime dependency into the standalone server artifact', () => {
  const packageMetadata = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8')
  ) as { dependencies: Record<string, string> }
  const serverConfig = Array.isArray(config) ? config[0] : config
  const alwaysBundle = serverConfig.deps?.alwaysBundle

  if (typeof alwaysBundle !== 'function') assert.fail('alwaysBundle must be a function')
  for (const dependency of Object.keys(packageMetadata.dependencies)) {
    assert.equal(alwaysBundle(dependency, undefined), true, `${dependency} must be bundled`)
    assert.equal(
      alwaysBundle(`${dependency}/subpath`, undefined),
      true,
      `${dependency} subpaths must be bundled`
    )
  }
  assert.equal(alwaysBundle('@maaxyz/maa-node', undefined), false)
})
