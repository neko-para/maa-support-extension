import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import test from 'node:test'

import {
  loadPublishedPackages,
  parseBumpRequest,
  planVersionBumps,
  resolveNextVersion,
  writeVersionPlan
} from '../version-packages.mjs'

function pkg(name, version, dependencies = []) {
  return {
    name: `@nekosu/${name}`,
    dir: name,
    version,
    dependencies,
    manifest: { name: `@nekosu/${name}`, version },
    manifestPath: `${name}/package.json`
  }
}

test('propagates patch bumps to all transitive published dependents', () => {
  const packages = [
    pkg('base', '1.2.3'),
    pkg('middle', '2.0.0', ['@nekosu/base']),
    pkg('leaf', '3.4.5', ['@nekosu/middle'])
  ]

  const plan = planVersionBumps(packages, [parseBumpRequest('base=minor')])
  assert.deepEqual(
    plan.map(entry => [entry.name, entry.nextVersion]),
    [
      ['@nekosu/base', '1.3.0'],
      ['@nekosu/middle', '2.0.1'],
      ['@nekosu/leaf', '3.4.6']
    ]
  )
})

test('keeps an explicit dependent bump and only schedules shared dependents once', () => {
  const packages = [
    pkg('base-a', '1.0.0'),
    pkg('base-b', '1.0.0'),
    pkg('middle', '1.0.0', ['@nekosu/base-a', '@nekosu/base-b']),
    pkg('leaf', '1.0.0', ['@nekosu/middle'])
  ]

  const plan = planVersionBumps(packages, [
    parseBumpRequest('base-a=patch'),
    parseBumpRequest('base-b=patch'),
    parseBumpRequest('middle=minor')
  ])
  assert.deepEqual(
    plan.map(entry => [entry.name, entry.nextVersion]),
    [
      ['@nekosu/base-a', '1.0.1'],
      ['@nekosu/base-b', '1.0.1'],
      ['@nekosu/middle', '1.1.0'],
      ['@nekosu/leaf', '1.0.1']
    ]
  )
  assert.deepEqual(plan.find(entry => entry.name === '@nekosu/middle').reasons, [
    'requested minor',
    'depends on @nekosu/base-a',
    'depends on @nekosu/base-b'
  ])
})

test('accepts explicit newer versions and rejects invalid version requests', () => {
  assert.equal(resolveNextVersion('1.2.3', '2.0.0'), '2.0.0')
  assert.throws(() => resolveNextVersion('1.2.3', '1.2.3'), /must be newer/)
  assert.throws(() => resolveNextVersion('1.2.3', 'next'), /stable semantic version/)
  assert.throws(() => parseBumpRequest('maa-tasker'), /Invalid bump request/)
})

test('loads workspace runtime dependencies and writes the complete plan', async t => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'maa-package-versions-'))
  t.after(async () => {
    await fs.rm(repoRoot, { recursive: true, force: true })
  })

  const manifests = [
    {
      dir: 'base',
      value: {
        name: '@nekosu/base',
        version: '1.0.0',
        publishConfig: { access: 'public' }
      }
    },
    {
      dir: 'consumer',
      value: {
        name: '@nekosu/consumer',
        version: '2.0.0',
        publishConfig: { access: 'public' },
        dependencies: { '@nekosu/base': 'workspace:*' }
      }
    },
    {
      dir: 'internal',
      value: {
        name: '@mse/internal',
        version: '1.0.0',
        dependencies: { '@nekosu/base': 'workspace:*' }
      }
    }
  ]

  for (const manifest of manifests) {
    const folder = path.join(repoRoot, 'pkgs', manifest.dir)
    await fs.mkdir(folder, { recursive: true })
    await fs.writeFile(path.join(folder, 'package.json'), JSON.stringify(manifest.value))
  }

  const packages = await loadPublishedPackages(repoRoot)
  assert.deepEqual(
    packages.map(entry => [entry.name, entry.dependencies]),
    [
      ['@nekosu/base', []],
      ['@nekosu/consumer', ['@nekosu/base']]
    ]
  )

  const plan = planVersionBumps(packages, [parseBumpRequest('@nekosu/base=patch')])
  await writeVersionPlan(plan)

  const base = JSON.parse(await fs.readFile(path.join(repoRoot, 'pkgs/base/package.json'), 'utf8'))
  const consumer = JSON.parse(
    await fs.readFile(path.join(repoRoot, 'pkgs/consumer/package.json'), 'utf8')
  )
  assert.equal(base.version, '1.0.1')
  assert.equal(consumer.version, '2.0.1')
})
