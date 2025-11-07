import type { Patch } from 'immer'

import type { RootInfo } from './root'
import type { GlobalState, LocalState } from './state'
import { ControlViewState } from './webview/control'

export type ApiMeta = {
  '/state/getGlobalConfig': {
    req: {}
    rsp: GlobalState
  }
  '/state/getLocalConfig': {
    req: {}
    rsp: LocalState
  }
  '/state/getControlView': {
    req: {}
    rsp: ControlViewState
  }

  '/native/listRegistry': {
    req: {}
    rsp: {
      name: string
      url: string
      using: boolean
    }[]
  }
  '/native/listVersion': {
    req: {}
    rsp: {
      version: string
      local: boolean
      using: boolean
    }[]
  }

  '/root/list': {
    req: {}
    rsp: {
      active?: RootInfo
      info: RootInfo[]
    }
  }
  '/root/refresh': {
    req: {}
    rsp: {}
  }
  '/root/select': {
    req: {
      index: number
    }
    rsp: {}
  }
  '/root/selectPath': {
    req: {
      path: string
    }
    rsp: {}
  }

  '/lsp/start': {
    req: {
      port: number
    }
    rsp: {}
  }
}

export type SseMeta = {
  'state/updateGlobal': Patch[]
  'state/updateLocal': Patch[]
  'state/updateControlView': Patch[]
}
