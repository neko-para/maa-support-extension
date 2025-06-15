export type ImplType = { command: string; builtin?: never }
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
  | Impl

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
  | Impl
) & {
  seq?: number
}
