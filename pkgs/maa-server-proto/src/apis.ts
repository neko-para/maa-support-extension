import type { InterfaceRuntime } from '@mse/types'

type MarkReturnPromise<Func> = Func extends (...args: infer Args) => infer Ret
  ? (...args: Args) => Ret | Promise<Ret>
  : Func

export type HostToSubApis = {
  updateController: (runtime: InterfaceRuntime['controller_param']) => boolean
  setupInstance: (runtime: InterfaceRuntime) => {
    handle?: string
    error?: string
  }
  getScreencap: () => string | null

  refreshAdb: () => maa.AdbDevice[]
}

export type SubToHostApis = {
  test: () => void
}

export type MarkApisImpl<T> = {
  [K in keyof T]: MarkReturnPromise<T[K]>
}

export type MarkApis<Server, Client> = MarkApisImpl<Server> & Readonly<MarkApisImpl<Client>>
