import { type ControlViewState, type GlobalState, type LocalState } from '@maaxyz/maa-support-types'
import { applyPatches } from 'immer'
import { shallowRef } from 'vue'

import { request, subscribe } from '../utils/api'

export const globalState = shallowRef<GlobalState>({})
export const localState = shallowRef<LocalState>({})
export const controlViewState = shallowRef<ControlViewState>({})

export async function initConfig() {
  const globalInitial = await request('/state/getGlobalConfig', {})
  if (globalInitial) {
    globalState.value = globalInitial
    subscribe('state/updateGlobal', patches => {
      globalState.value = applyPatches(globalState.value, patches)
    })
  }

  const localInitial = await request('/state/getLocalConfig', {})
  if (localInitial) {
    localState.value = localInitial
    subscribe('state/updateLocal', patches => {
      localState.value = applyPatches(localState.value, patches)
    })
  }

  const controlViewInitial = await request('/state/getControlView', {})
  if (controlViewInitial) {
    controlViewState.value = controlViewInitial
    subscribe('state/updateControlView', patches => {
      controlViewState.value = applyPatches(controlViewState.value, patches)
    })
  }
}
