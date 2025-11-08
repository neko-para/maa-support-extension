import { RootInfo } from '@maaxyz/maa-support-types'
import EventEmitter from 'events'
import * as fs from 'fs/promises'
import * as path from 'path'

import { localStateService } from '.'
import { handle } from '../server'
import { BaseService } from './base'

export class RootService extends BaseService<{
  refreshingChanged: []
  rootInfosChanged: []
  activeRootInfoChanged: []
}> {
  rootInfos: RootInfo[] = []
  activeRootInfo?: RootInfo

  refreshing = false

  constructor() {
    super()
  }

  async init() {
    await this.refresh()
  }

  listen() {
    handle('/root/list', req => {
      return {
        active: this.activeRootInfo,
        info: this.rootInfos
      }
    })
    handle('/root/refresh', async req => {
      await this.refresh()
    })
    handle('/root/select', async req => {
      await this.select(req.index)
      return {}
    })
    handle('/root/selectPath', async req => {
      await this.selectPath(req.path)
      return {}
    })
  }

  async refresh() {
    if (this.refreshing) {
      return
    }
    this.refreshing = true
    this.emitter.emit('refreshingChanged')

    const wait = new Promise(resolve => {
      setTimeout(resolve, 1000)
    })

    const old = this.activeRootInfo?.interfaceRelative ?? localStateService.state.activeInterface
    const roots = await RootService.locate()

    await wait

    if (roots.length > 0) {
      this.rootInfos = roots
      this.activeRootInfo = roots.find(info => info.interfaceRelative === old) ?? roots[0]
    } else {
      this.rootInfos = []
      this.activeRootInfo = undefined
    }

    await localStateService.reduce(state => {
      state.activeInterface = this.activeRootInfo?.interfaceRelative
    })

    this.emitter.emit('rootInfosChanged')
    this.emitter.emit('activeRootInfoChanged')
    this.refreshing = false
    this.emitter.emit('refreshingChanged')
  }

  async select(index: number) {
    if (index < 0 || index >= this.rootInfos.length) {
      this.activeRootInfo = undefined
    } else {
      this.activeRootInfo = this.rootInfos[index]
    }

    await localStateService.reduce(state => {
      state.activeInterface = this.activeRootInfo?.interfaceRelative
    })

    this.emitter.emit('activeRootInfoChanged')
  }

  async selectPath(path: string) {
    const index = this.rootInfos.findIndex(info => info.interfaceRelative === path)
    await this.select(index)
  }

  static async locate() {
    const root = process.cwd()

    const result: RootInfo[] = []

    const travel = async (current: string) => {
      const childs = await fs.readdir(current, { withFileTypes: true })
      for (const child of childs) {
        if (['node_modules'].includes(child.name) || child.name.startsWith('.')) {
          continue
        }
        if (child.name === 'interface.json' && child.isFile()) {
          result.push({
            folder: current,
            folderRelative: current.replace(root + path.sep, ''),
            interface: path.join(current, 'interface.json'),
            interfaceRelative: path.join(current, 'interface.json').replace(root + path.sep, '')
          })
        }
        if (child.isDirectory()) {
          await travel(path.join(current, child.name))
        }
      }
    }

    await travel(root)

    return result
  }
}
