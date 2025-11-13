import type { Patch } from 'immer'

import { InterfaceRuntime } from './pi_config'
import type { RootInfo } from './root'
import type { GlobalState, LocalState } from './state'
import { ControlViewState, PageType } from './webview'

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
  '/interface/buildRuntime': {
    req: {
      skipTask?: boolean
    }
    rsp: {
      runtime?: InterfaceRuntime
      error?: string
    }
  }

  '/launch/create': {
    req: {
      runtime: InterfaceRuntime
      pageId: string
    }
    rsp: {
      succ: boolean
      error?: string
    }
  }
  '/launch/start': {
    req: {
      pageId: string
    }
    rsp: {}
  }

  '/page/close': {
    req: {
      pageId: string
    }
    rsp: {}
  }

  '/host/forward': {
    req: {
      method: string
      data: unknown
    }
    rsp: {
      data: unknown
    }
  }
}

export type HostApiMeta = {
  addPage: {
    req: {
      type: PageType
      id: string
      data: unknown
    }
    rsp: {
      succ: boolean
    }
  }
  getPageData: {
    req: {
      id: string
    }
    rsp: {
      data: unknown
    }
  }
}

export type SseMeta = {
  'state/updateGlobal': Patch[]
  'state/updateLocal': Patch[]
  'state/updateControlView': Patch[]

  'launch/message': {
    id: string
    msg: maa.TaskerNotify | maa.TaskerContextNotify
  }
}
