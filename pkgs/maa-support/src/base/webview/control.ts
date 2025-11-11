import { ControlViewState } from '@maaxyz/maa-support-types'
import { Patch } from 'immer'

import { interfaceService, rootService } from '..'
import { handle, pushEvent } from '../../server'
import { BaseMemoryStateService } from '../state'

export class ControlViewStateService extends BaseMemoryStateService<ControlViewState> {
  constructor() {
    super({})
  }

  async init() {
    this.reduce(state => {
      state.interface = rootService.rootInfos.map(root => root.interfaceRelative)
      state.refreshingInterface = false
    })

    rootService.emitter.addListener('refreshingChanged', () => {
      this.reduce(state => {
        state.refreshingInterface = rootService.refreshing
      })
    })
    rootService.emitter.addListener('rootInfosChanged', () => {
      this.reduce(state => {
        state.interface = rootService.rootInfos.map(root => root.interfaceRelative)
      })
    })

    interfaceService.emitter.addListener('interfaceChanged', () => {
      this.reduce(state => {
        state.interfaceJson = interfaceService.interfaceJson
      })
    })
  }

  listen() {
    handle('/state/getControlView', req => {
      return this.state
    })
  }

  push(patches: Patch[]) {
    pushEvent('state/updateControlView', patches)
  }
}
