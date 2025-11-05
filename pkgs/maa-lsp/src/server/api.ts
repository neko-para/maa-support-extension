export type GlobalState = {
  registryType?: string
  explicitVersion?: string
}

export type LocalState = {
  activeInterface?: string
}

export type RootInfo = {
  folder: string
  folderRelative: string
  interface: string
  interfaceRelative: string
  config: string
}

export type ApiMeta = {
  '/state/getGlobalConfig': {
    req: {}
    rsp: GlobalState
  }
  '/state/getLocalConfig': {
    req: {}
    rsp: LocalState
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
}
