import EventEmitter from 'node:events'
import * as path from 'node:path'

import type { Bundle } from '../bundle/bundle'
import { ContentJson } from '../content/json'
import type { IContentLoader } from '../content/loader'
import type { IContentWatcher } from '../content/watch'

export class Interface extends EventEmitter<{
  interfaceChanged: []
}> {
  root: string

  content: ContentJson

  active: string
  bundles: {
    root: string
    bundle: Bundle
  }[]

  constructor(
    loader: IContentLoader,
    watcher: IContentWatcher,
    root: string,
    file = 'interface.json'
  ) {
    super()

    this.root = root

    this.content = new ContentJson(loader, watcher, path.join(this.root, file), () => {
      this.emit('interfaceChanged')
    })

    this.active = ''
    this.bundles = []
  }

  async load() {
    await this.content.load()
  }

  async flush() {
    await this.content.flush()
  }
}
