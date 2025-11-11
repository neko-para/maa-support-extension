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

  '/lsp/start': {
    req: {
      port: number
    }
    rsp: {}
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

  '/interface/selectResource': {
    req: {
      index: number
    }
    rsp: {}
  }
  '/interface/selectController': {
    req: {
      index: number
    }
    rsp: {}
  }
  '/interface/configAdb': {
    req: {
      adb_path: string
      address: string
      config: unknown
    }
    rsp: {}
  }
  '/interface/configDesktop': {
    req: {
      hwnd: maa.DesktopHandle
    }
    rsp: {}
  }
  '/interface/configVscFixed': {
    req: {}
    rsp: {}
  }
  '/interface/native/refreshAdb': {
    req: {}
    rsp: {
      devices: maa.AdbDevice[] | null
    }
  }
  '/interface/native/refreshDesktop': {
    req: {}
    rsp: {
      devices: maa.DesktopDevice[] | null
    }
  }
  '/interface/addTask': {
    req: {
      task: string
    }
    rsp: {}
  }
  '/interface/removeTask': {
    req: {
      key: string
    }
    rsp: {}
  }
  '/interface/configTask': {
    req: {
      key: string
      option: string
      name: string
      value?: string
    }
    rsp: {}
  }
}

export type SseMeta = {
  'state/updateGlobal': Patch[]
  'state/updateLocal': Patch[]
  'state/updateControlView': Patch[]
}
