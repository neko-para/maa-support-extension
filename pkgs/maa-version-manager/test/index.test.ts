import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import test from 'node:test'

import { MaaVersionManager } from '../src/index.ts'

const version = '1.2.3'

class TestVersionManager extends MaaVersionManager {
  extracts: string[] = []
  failExtractAt = 0
  failCommit = false

  protected override async extract(packageSpec: string, destination: string) {
    this.extracts.push(packageSpec)
    if (this.extracts.length === this.failExtractAt) {
      throw new Error('extract failed')
    }
    await fs.mkdir(destination, { recursive: true })
    await fs.writeFile(path.join(destination, 'package.json'), '{}')
  }

  protected override async commitInstall(stagingFolder: string, versionFolder: string) {
    if (this.failCommit) {
      throw new Error('commit failed')
    }
    await super.commitInstall(stagingFolder, versionFolder)
  }
}

async function createManager(t: test.TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maa-version-manager-'))
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  const manager = new TestVersionManager(root)
  await manager.init()
  return manager
}

async function assertLockReleased(manager: MaaVersionManager) {
  const release = await manager.lock()
  assert.ok(release, 'prepare() should always release the version-manager lock')
  await release()
}

async function assertNoStagingFolders(manager: MaaVersionManager) {
  const entries = await fs.readdir(manager.installPath)
  assert.equal(
    entries.some(entry => entry.startsWith('.prepare-')),
    false
  )
}

test('installs a complete version atomically and reuses it', async t => {
  const manager = await createManager(t)
  const progress: string[] = []

  assert.equal(await manager.prepare(version, step => progress.push(step)), true)
  assert.deepEqual(progress, [
    'prepare-folder',
    'download-scripts',
    'download-binary',
    'move-folders',
    'finish'
  ])
  assert.equal(manager.extracts.length, 2)
  assert.equal(existsSync(path.join(manager.versionFolder(version), 'timestamp')), true)
  assert.equal(existsSync(path.join(manager.moduleFolder(version), '@maaxyz', 'maa-node')), true)
  assert.equal(
    existsSync(
      path.join(
        manager.moduleFolder(version),
        '@maaxyz',
        `maa-node-${process.platform}-${process.arch}`
      )
    ),
    true
  )

  progress.length = 0
  assert.equal(await manager.prepare(version, step => progress.push(step)), true)
  assert.deepEqual(progress, [])
  assert.equal(manager.extracts.length, 2)
  await assertNoStagingFolders(manager)
})

test('rolls back an extraction failure and releases the lock', async t => {
  const manager = await createManager(t)
  manager.failExtractAt = 2
  const progress: string[] = []

  assert.equal(await manager.prepare(version, step => progress.push(step)), false)
  assert.deepEqual(progress, ['prepare-folder', 'download-scripts', 'download-binary', 'finish'])
  assert.equal(existsSync(manager.versionFolder(version)), false)
  await assertNoStagingFolders(manager)
  await assertLockReleased(manager)
})

test('rolls back a commit failure and releases the lock', async t => {
  const manager = await createManager(t)
  manager.failCommit = true

  assert.equal(await manager.prepare(version, () => {}), false)
  assert.equal(existsSync(manager.versionFolder(version)), false)
  await assertNoStagingFolders(manager)
  await assertLockReleased(manager)
})

test('replaces an incomplete existing installation', async t => {
  const manager = await createManager(t)
  const versionFolder = manager.versionFolder(version)
  await fs.mkdir(versionFolder, { recursive: true })
  await fs.writeFile(path.join(versionFolder, 'timestamp'), '0')

  assert.equal(await manager.prepare(version, () => {}), true)
  assert.equal(manager.extracts.length, 2)
  assert.equal(existsSync(path.join(manager.moduleFolder(version), '@maaxyz', 'maa-node')), true)
  await assertNoStagingFolders(manager)
})
