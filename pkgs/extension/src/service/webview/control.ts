import { ControlHostState, ControlHostToWeb, ControlWebToHost } from '@mse/types'
import { WebviewProvider, provideWebview } from '@mse/utils'

import { interfaceService, rootService } from '..'
import { maa } from '../../maa'
import { BaseService, context } from '../context'

export class WebviewControlService extends BaseService {
  provider?: WebviewProvider<ControlHostToWeb, ControlWebToHost>

  constructor() {
    super()
  }

  async init() {
    this.provider = provideWebview<ControlHostToWeb, ControlWebToHost>({
      context,
      folder: 'webview',
      index: 'control',
      webId: 'maa.view.control-panel-new',
      dev: true
    })

    this.provider.recv = async data => {
      switch (data.command) {
        case '__init':
          this.pushState()
          break
        case 'refreshInterface':
          await rootService.refresh()
          break
        case 'selectInterface':
          rootService.selectPath(data.path)
          break
        case 'selectResource':
          interfaceService.reduceConfig({
            resource: interfaceService.interfaceJson.resource?.[data.index].name
          })
          break
        case 'refreshAdb':
          this.provider?.response(data.seq, await maa.AdbController.find())
          break
        case 'configAdb':
          interfaceService.reduceConfig({
            adb: {
              adb_path: data.adb,
              address: data.address,
              config: data.config
            }
          })
          break
      }
    }

    this.defer = rootService.onRefreshingChanged(() => {
      this.pushState()
    })

    this.defer = rootService.onActiveResourceChanged(() => {
      this.pushState()
    })

    this.defer = interfaceService.onInterfaceChanged(() => {
      this.pushState()
    })

    this.defer = interfaceService.onInterfaceConfigChanged(() => {
      this.pushState()
    })
  }

  get state(): ControlHostState {
    return {
      interface: rootService.resourceRoots.map(root => root.interfaceRelative),
      activeInterface: rootService.activeResource?.interfaceRelative,
      refreshingInterface: rootService.refreshing,

      interfaceJson: interfaceService.interfaceJson,
      interfaceConfigJson: interfaceService.interfaceConfigJson
    }
  }

  pushState() {
    this.provider?.send({
      command: 'updateState',
      state: this.state
    })
  }
}
