export type ImplType = { command: string }
export type HostToWeb<Impl extends ImplType> =
  | {
      command: '__updateBodyClass'
      htmlStyle: string
      bodyClass: string
      builtin: true
    }
  // | {
  //     command: '__updateState'
  //     state: unknown
  //     builtin: true
  //   }
  | {
      command: '__response'
      seq: number
      data: unknown
      builtin: true
    }
  | (Impl & {
      builtin?: never
    })

export type WebToHost<Impl extends ImplType> = (
  | {
      command: '__init'
      builtin: true
    }
  // | {
  //     command: '__setState'
  //     state: unknown
  //     builtin: true
  //   }
  | {
      command: '__keyDown'
      data: Record<string, unknown>
      builtin: true
    }
  | (Impl & {
      builtin?: never
    })
) & {
  seq?: number
}

export type HostStateBase = {
  isMAA?: boolean
  fwStatus?: string[]
  locale?: 'zh' | 'en'
}
