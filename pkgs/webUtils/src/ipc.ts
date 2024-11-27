import { ref, watch } from 'vue'

import type { IpcFromHost, IpcRest, IpcToHost, IpcToHostBuiltin } from '@mse/types'

export function useIpc<Context extends {}, TH extends IpcRest, FH extends IpcRest>(
  initContext: Context,
  inited: () => void
) {
  const vscodeApi = acquireVsCodeApi()

  const handler = ref<(data: FH) => void>(() => {})

  const context = ref<Context>(initContext)

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
      if (data.cmd === 'initContext') {
        context.value = data.ctx

        watch(
          () => context.value,
          ctx => {
            // console.log(JSON.stringify(ctx))
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
      }
    } else {
      handler.value(ev.data)
    }
  })

  realPost({
    __builtin: true,
    cmd: 'requestInit'
  })

  return {
    context,
    handler,
    postMessage
  }
}
