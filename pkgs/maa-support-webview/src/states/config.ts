import {
  type ApiMeta,
  type ControlViewState,
  type GlobalState,
  type LocalState,
  type SseMeta
} from '@maaxyz/maa-support-types'
import { type Patch, applyPatches } from 'immer'
import { type ShallowRef, shallowRef } from 'vue'

import { request, subscribe } from '../utils/api'

export const globalState = shallowRef<GlobalState>({})
export const localState = shallowRef<LocalState>({})
export const controlViewState = shallowRef<ControlViewState>({})

function trackState<Getter extends keyof ApiMeta, Updater extends keyof SseMeta>(
  state: ShallowRef<ApiMeta[Getter]['rsp']>,
  getter: Getter,
  updater: Updater
) {
  const fullUpdate = async () => {
    const initial = await request(getter, {})
    if (initial) {
      state.value = initial
    }
  }

  fullUpdate()
  subscribe(
    updater,
    patches => {
      state.value = applyPatches(state.value, patches as Patch[])
    },
    () => {
      fullUpdate()
    }
  )

  return state
}

export async function initConfig() {
  trackState(globalState, '/state/getGlobalConfig', 'state/updateGlobal')
  trackState(localState, '/state/getLocalConfig', 'state/updateLocal')
  trackState(controlViewState, '/state/getControlView', 'state/updateControlView')
}
