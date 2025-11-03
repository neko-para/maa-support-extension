import { existsSync } from 'fs'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

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

  async reduce(change: Partial<State> | ((state: State) => State)) {
    if (typeof change === 'function') {
      this.state = change(this.state)
    } else {
      this.state = {
        ...this.state,
        ...change
      }
    }
    await fs.writeFile(this.file, JSON.stringify(this.state))
  }
}

export type GlobalState = {
  registryType?: string
  explicitVersion?: string
}

export class GlobalStateService extends BaseStateService<GlobalState> {
  constructor() {
    super(os.homedir(), {})
  }
}

export type LocalState = {
  activeInterface?: string
}

export class LocalStateService extends BaseStateService<LocalState> {
  constructor() {
    super(process.cwd(), {})
  }
}
