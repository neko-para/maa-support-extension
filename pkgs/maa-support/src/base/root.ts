import { RootInfo } from '@maaxyz/maa-support-types'
import * as fs from 'fs/promises'
import * as path from 'path'

import { localStateService } from '.'
import { handle } from '../server'
import { BaseService } from './base'

export class RootService extends BaseService {
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

    const old = this.activeRootInfo?.interfaceRelative ?? localStateService.state.activeInterface
    const roots = await RootService.locate()
    if (roots.length > 0) {
      this.rootInfos = roots
      this.activeRootInfo = roots.find(info => info.interfaceRelative === old) ?? roots[0]
    } else {
      this.rootInfos = []
      this.activeRootInfo = undefined
    }

    await localStateService.reduce({
      activeInterface: this.activeRootInfo?.interfaceRelative
    })

    this.refreshing = false
  }

  async select(index: number) {
    if (index < 0 || index >= this.rootInfos.length) {
      this.activeRootInfo = undefined
    } else {
      this.activeRootInfo = this.rootInfos[index]
    }

    await localStateService.reduce({
      activeInterface: this.activeRootInfo?.interfaceRelative
    })
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
            interfaceRelative: path.join(current, 'interface.json').replace(root + path.sep, ''),
            config: path.join(current, 'config', 'maa_pi_config.json')
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
