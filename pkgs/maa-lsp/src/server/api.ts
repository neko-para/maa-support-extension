export type GlobalState = {
  registryType?: string
  explicitVersion?: string
}

export type LocalState = {
  activeInterface?: string
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
}
