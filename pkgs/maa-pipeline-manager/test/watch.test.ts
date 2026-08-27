import type { FSWatcher } from 'chokidar'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import { FsContentWatcher, type IContentWatcherDelegate } from '../src/content/watch.ts'

const delegate: IContentWatcherDelegate = {
  filter: () => true,
  fileAdded() {},
  fileChanged() {},
  fileDeleted() {}
}

class InspectableWatcher extends FsContentWatcher {
  inspectOptions(platform: NodeJS.Platform) {
    return this.createOptions(delegate, platform)
  }
}

test('FsContentWatcher uses polling by default on macOS', () => {
  assert.equal(new InspectableWatcher().inspectOptions('darwin').usePolling, true)
  assert.equal(new InspectableWatcher().inspectOptions('linux').usePolling, false)
  assert.equal(new InspectableWatcher().inspectOptions('win32').usePolling, false)
})

test('FsContentWatcher allows its platform default to be overridden', () => {
  assert.equal(
    new InspectableWatcher({ usePolling: false }).inspectOptions('darwin').usePolling,
    false
  )
  assert.equal(
    new InspectableWatcher({ usePolling: true }).inspectOptions('linux').usePolling,
    true
  )
})

test('FsContentWatcher closes a partially initialized watcher and preserves its error', async () => {
  const cause = Object.assign(new Error('too many open files, watch'), { code: 'EMFILE' })
  let closeCalls = 0

  class FailingWatcher extends FsContentWatcher {
    protected createWatcher(): FSWatcher {
      const watcher = new EventEmitter() as EventEmitter & {
        close(): Promise<void>
      }
      watcher.close = async () => {
        closeCalls += 1
      }
      process.nextTick(() => watcher.emit('error', cause))
      return watcher as unknown as FSWatcher
    }
  }

  await assert.rejects(new FailingWatcher().watch('/resource', false, delegate), error => {
    assert.ok(error instanceof Error)
    assert.match(error.message, /Failed to initialize file watcher/)
    assert.equal(error.cause, cause)
    return true
  })
  assert.equal(closeCalls, 1)
})
