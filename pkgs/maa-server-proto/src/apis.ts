import type { InterfaceRuntime } from '@mse/types'

type MarkReturnPromise<Func> = Func extends (...args: infer Args) => infer Ret
  ? (...args: Args) => Promise<Awaited<Ret> | null>
  : Func

export type HostToSubApis = {
  updateController: (runtime: InterfaceRuntime['controller_param']) => boolean
  setupInstance: (runtime: InterfaceRuntime) => {
    handle?: string
    error?: string
  }
  getScreencap: () => string | null

  refreshAdb: () => maa.AdbDevice[]
  refreshDesktop: () => maa.DesktopDevice[]

  postTask: (inst: string, task: string, pipeline_override: Record<string, unknown>[]) => boolean
  postStop: (inst: string) => void
  getKnownTasks: (inst: string) => string[]
  destroyInstance: (inst: string) => void
}

export type SubToHostApis = {
  pushNotify: (inst: string, msg: unknown) => void
}

export type MarkApisImpl<T> = {
  [K in keyof T]: MarkReturnPromise<T[K]>
}

export type MarkApis<Server, Client> = MarkApisImpl<Server> & Readonly<MarkApisImpl<Client>>
