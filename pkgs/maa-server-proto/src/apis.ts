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
  performOcr: (isMaa: boolean, image: string, roi: maa.Rect, resources: string[]) => string
  performTemplateMatch: (image: string, roi: maa.Rect, threshold: number) => string
  performReco: (image: string, resources: string[]) => string

  refreshAdb: () => maa.AdbDevice[]
  refreshDesktop: () => maa.DesktopDevice[]

  postTask: (inst: string, task: string, pipeline_override: Record<string, unknown>[]) => boolean
  postStop: (inst: string) => void
  getKnownTasks: (inst: string) => string[]
  destroyInstance: (inst: string) => void

  getRecoDetail: (
    inst: string,
    reco_id: maa.RecoId
  ) => { info: maa.RecoDetailWithoutDraws; raw: string; draws: string[] }
  getActDetail: (inst: string, act_id: maa.ActId) => maa.ActionDetail
  getNode: (inst: string, task: string) => string
}

export type SubToHostApis = {
  pushNotify: (inst: string, msg: unknown) => void

  startTask: (exec: string, args: string[], cwd: string, env: Record<string, string>) => string
  startDebugSession: (name: string, identifier: string) => string | null
  stopAgent: (id: string) => void

  quickPick: (items: string[]) => string | null
}

export type MarkApisImpl<T> = {
  [K in keyof T]: MarkReturnPromise<T[K]>
}

export type MarkApis<Server, Client> = MarkApisImpl<Server> & Readonly<MarkApisImpl<Client>>
