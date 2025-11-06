import { GlobalState, LocalState } from '@maaxyz/maa-support-types'
import { existsSync } from 'fs'
import * as fs from 'fs/promises'
import { Patch, produceWithPatches } from 'immer'
import * as os from 'os'
import * as path from 'path'

import { handle, pushEvent } from '../server'
import { BaseService } from './base'

class BaseStateService<State> extends BaseService {
  folder: string
  file: string
  state: State

  constructor(folder: string, init: State) {
    super()

    this.folder = path.join(folder, '.maalsp')
    this.file = path.join(this.folder, 'config.json')
    this.state = init
  }

  async init() {
    await fs.mkdir(this.folder, { recursive: true })
    await fs.writeFile(path.join(this.folder, '.gitignore'), '*\n')

    if (existsSync(this.file)) {
      this.state = JSON.parse(await fs.readFile(this.file, 'utf8'))
    }
  }

  async reduce(change: (state: State) => void) {
    const [newState, patches] = produceWithPatches(this.state, change)
    this.state = newState
    this.push(patches)

    await fs.writeFile(this.file, JSON.stringify(this.state))
  }

  push(patches: Patch[]) {}
}

export class GlobalStateService extends BaseStateService<GlobalState> {
  constructor() {
    super(os.homedir(), {})
  }

  listen() {
    handle('/state/getGlobalConfig', req => {
      return this.state
    })
  }

  push(patches: Patch[]) {
    pushEvent('state/updateGlobal', patches)
  }
}

export class LocalStateService extends BaseStateService<LocalState> {
  constructor() {
    super(process.cwd(), {})
  }

  listen() {
    handle('/state/getLocalConfig', req => {
      return this.state
    })
  }

  push(patches: Patch[]) {
    pushEvent('state/updateLocal', patches)
  }
}
