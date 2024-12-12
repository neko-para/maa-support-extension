import { ref, watch } from 'vue'

import type { IpcFromHost, IpcRest, IpcToHost } from '@mse/types'

export function useIpc<Context, TH extends IpcRest, FH extends IpcRest>(inited: () => void) {
  const vscodeApi = acquireVsCodeApi()

  const handler = ref<(data: FH) => void>(() => {})

  let sync = false
  const context = ref<Context>({} as Context)

  const realPost = (data: IpcToHost<Context, TH>) => {
    // console.log('[webv] post', data)
    vscodeApi.postMessage(JSON.stringify(data))
  }

  const postMessage = (data: TH) => {
    realPost(data)
  }

  window.addEventListener('message', ev => {
    const data = JSON.parse(ev.data) as IpcFromHost<Context, FH>
    // console.log('[webv] recv', data)
    if (data.__builtin) {
      switch (data.cmd) {
        case 'initContext':
          context.value = data.ctx

          watch(
            () => context.value,
            ctx => {
              if (!sync) {
                realPost({
                  __builtin: true,
                  cmd: 'updateContext',
                  ctx
                })
              }
            },
            {
              deep: true,
              flush: 'sync'
            }
          )

          inited()
          break
        case 'updateContext':
          sync = true
          context.value = data.ctx
          sync = false
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

  const postAwake = () => {
    realPost({
      __builtin: true,
      cmd: 'awake'
    })
  }

  return {
    context,
    handler,
    postMessage,
    postAwake
  }
}
