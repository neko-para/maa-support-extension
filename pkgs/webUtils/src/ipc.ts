import { ref, watch } from 'vue'

import type { IpcFromHost, IpcRest, IpcToHost, IpcToHostBuiltin } from '@mse/types'

export function useIpc<HostContext, WebvContext, TH extends IpcRest, FH extends IpcRest>(
  inited: () => void
) {
  const vscodeApi = acquireVsCodeApi()

  const handler = ref<(data: FH) => void>(() => {})

  let sync = false

  const hostContext = ref<HostContext>({} as HostContext)
  const webvContext = ref<WebvContext>({} as WebvContext)

  const realPost = (data: IpcToHost<WebvContext, TH>) => {
    // console.log('[webv] post', data)
    vscodeApi.postMessage(JSON.stringify(data))
  }

  const postMessage = (data: TH) => {
    realPost(data)
  }

  window.addEventListener('message', ev => {
    const data = JSON.parse(ev.data) as IpcFromHost<HostContext, WebvContext, FH>
    // console.log('[webv] recv', data)
    if (data.__builtin) {
      switch (data.cmd) {
        case 'initContext':
          webvContext.value = data.ctx

          watch(
            () => webvContext.value,
            ctx => {
              realPost({
                __builtin: true,
                cmd: 'updateContext',
                ctx
              })
            },
            {
              deep: true
            }
          )

          inited()
          break
        case 'updateContext':
          hostContext.value = data.ctx
          break
      }
    } else {
      handler.value(data)
    }
  })

  realPost({
    __builtin: true,
    cmd: 'requestInit'
  })

  return {
    hostContext,
    webvContext,
    handler,
    postMessage
  }
}
