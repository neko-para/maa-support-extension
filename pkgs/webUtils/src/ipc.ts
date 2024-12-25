import { ref, watch } from 'vue'

import type { IpcFromHost, IpcRest, IpcToHost, LogCategory } from '@mse/types'

function fakeRef<T>() {
  return ref<T>({} as any)
}

type RefResult<T> = ReturnType<typeof fakeRef<T>>

type IpcInst<Context, TH extends IpcRest, FH extends IpcRest> = {
  context: RefResult<Context>
  handler: RefResult<(data: FH) => void>
  postMessage: (data: TH) => void
  postAwake: () => void
  log: Record<LogCategory, (msg: any) => void>
}

declare global {
  interface Window {
    mseIpc?: any
  }
}

if (import.meta.env.DEV) {
  await import('@vscode-elements/webview-playground')
  document.body.append(document.createElement('vscode-dev-toolbar'))
}

export function useIpc<Context, TH extends IpcRest, FH extends IpcRest>(
  inited: () => void
): IpcInst<Context, TH, FH> {
  if (window.mseIpc) {
    return window.mseIpc
  }

  const handler = ref<(data: FH) => void>(() => {})

  let sync = false
  const context = ref<Context>({} as Context)

  let openedRes: () => void = () => {}
  const opened = new Promise<void>(resolve => {
    openedRes = resolve
  })

  const realPost = (() => {
    if (import.meta.env.DEV) {
      const urlParams = new URLSearchParams(window.location.search)
      let port = parseInt(urlParams.get('msePort') ?? '8080')
      if (isNaN(port)) {
        port = 8080
      }
      const socket = new WebSocket(`ws://127.0.0.1:${port}`)
      socket.onopen = () => {
        openedRes()
      }

      socket.onmessage = e => {
        processMessage(e)
      }

      socket.onclose = () => {
        window.close()
      }

      return (data: IpcToHost<Context, TH>) => {
        socket.send(JSON.stringify(data))
      }
    } else {
      const vscodeApi = acquireVsCodeApi()
      openedRes()
      return (data: IpcToHost<Context, TH>) => {
        vscodeApi.postMessage(JSON.stringify(data))
      }
    }
  })()

  const postMessage = (data: TH) => {
    realPost(data)
  }

  const processMessage = (ev: MessageEvent<string>) => {
    const data = JSON.parse(ev.data) as IpcFromHost<Context, FH>
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
  }

  if (!import.meta.env.DEV) {
    window.addEventListener('message', processMessage)
  }

  opened.then(() => {
    realPost({
      __builtin: true,
      cmd: 'requestInit'
    })
  })

  const postAwake = () => {
    realPost({
      __builtin: true,
      cmd: 'awake'
    })
  }

  const log = new Proxy(
    {},
    {
      get(_, key: string) {
        return (msg: any) => {
          realPost({
            __builtin: true,
            cmd: 'log',
            message: `${msg}`,
            type: key as LogCategory
          })
        }
      }
    }
  ) as Record<LogCategory, (msg: any) => void>

  return (window.mseIpc = {
    context,
    handler,
    postMessage,
    postAwake,
    log
  })
}
