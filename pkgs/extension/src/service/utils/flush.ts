import { DisposableHelper } from '../context'

export abstract class FlushHelper extends DisposableHelper {
  abstract doFlush(): Promise<void>

  flushing: boolean = false
  needFlush: boolean = false
  cacheResolves: (() => void)[] = []

  async flushDirty() {
    if (this.flushing) {
      this.needFlush = true
      return new Promise<void>(resolve => {
        this.cacheResolves.push(resolve)
      })
    }

    this.flushing = true
    await this.doFlush()
    this.flushing = false

    const resolves = this.cacheResolves
    this.cacheResolves = []
    if (resolves.length > 0) {
      setTimeout(() => {
        resolves.forEach(f => f())
      }, 0)
    }

    if (this.needFlush) {
      this.needFlush = false
      setTimeout(() => {
        this.flushDirty()
      }, 0)
    }
  }
}
