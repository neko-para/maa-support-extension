import {
  ShallowRef,
  computed,
  createSingletonComposable,
  extensionContext,
  ref,
  useWebviewPanel,
  useWebviewView,
  watch
} from 'reactive-vscode'
import vscode from 'vscode'

import { IpcFromHost, IpcFromHostBuiltin, IpcRest, IpcToHost } from '@mse/types'

import { vscfs } from './fs'
import { logger } from './logger'

// TODO: 看看怎么不抄两份

export function createUseWebView<Context, TH extends IpcRest, FH extends IpcRest>(
  dir: string,
  id: string
) {
  return createSingletonComposable(() => {
    const handler = ref<(data: TH) => void>(data => {
      logger.warn(`webview ${id} not handled ${JSON.stringify(data).slice(0, 200)}`)
    })
    const rootUri = vscode.Uri.joinPath(extensionContext.value!.extensionUri, dir)
    const html = ref('loading...')

    let sync = false
    const context = ref<Context>(
      extensionContext.value?.workspaceState.get<Context>(`webview:${id}:context`) ??
        ({} as Context)
    )

    let realPost: (data: IpcFromHost<Context, FH>) => void

    const awakeListener = ref<(() => void)[]>([])

    const { view, postMessage } = useWebviewView(id, html, {
      webviewOptions: {
        enableScripts: true,
        localResourceRoots: [rootUri]
      },
      onDidReceiveMessage(data: string) {
        // logger.silly(`webview ${id} recv ${data.slice(0, 200)}`)

        const msg = JSON.parse(data) as IpcToHost<Context, TH>
        if (msg.__builtin) {
          switch (msg.cmd) {
            case 'requestInit':
              realPost({
                __builtin: true,
                cmd: 'initContext',
                ctx: context.value
              })
              break
            case 'updateContext':
              extensionContext.value?.workspaceState.update(`webview:${id}:context`, msg.ctx)
              sync = true
              context.value = msg.ctx
              sync = false
              break
            case 'awake': {
              const funcs = [...awakeListener.value]
              logger.debug(`webview ${id} awake, listener count ${funcs.length}`)
              awakeListener.value = []
              visible.value = true
              funcs.forEach(f => f())
              break
            }
            case 'log':
              logger.log(msg.type, msg.message)
              break
          }
        } else {
          handler.value(msg)
        }
      }
    })

    realPost = (data: IpcFromHost<Context, FH>) => {
      const datastr = JSON.stringify(data)
      // logger.silly(`webview ${id} send ${datastr.slice(0, 200)}`)
      postMessage(datastr)
    }

    const post = (data: FH) => {
      realPost(data)
    }

    const visible = ref(false)

    watch(view, async v => {
      if (v) {
        const webRootUri = v.webview.asWebviewUri(rootUri)

        const htmlUri = vscode.Uri.joinPath(rootUri, 'index.html')
        const htmlContent = (await vscfs.readFile(htmlUri))
          .toString()
          .replaceAll('="./assets', `="${webRootUri.toString()}/assets`)
          .replaceAll('crossorigin href=', 'crossorigin id="vscode-codicon-stylesheet" href=')
          .replaceAll('%{cspSource}', v.webview.cspSource)

        html.value = htmlContent

        v.onDidChangeVisibility(e => {
          logger.debug(`webview ${id} change visibility ${v.visible}`)
          visible.value = v.visible
        })
        visible.value = false
      }
    })

    watch(
      context,
      ctx => {
        extensionContext.value?.workspaceState.update(`webview:${id}:context`, ctx)
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

    return {
      context,
      handler,
      post,
      visible,
      awakeListener
    }
  })
}

export function createUseWebPanel<Context, TH extends IpcRest, FH extends IpcRest>(
  dir: string,
  id: string,
  retain?: boolean
) {
  return async (title: string, column: vscode.ViewColumn) => {
    const handler = ref<(data: TH) => void>(data => {
      logger.warn(`webview ${id} not handled ${JSON.stringify(data).slice(0, 200)}`)
    })
    const rootUri = vscode.Uri.joinPath(extensionContext.value!.extensionUri, dir)
    const html = ref('loading...')

    let sync = false
    const context = ref<Context>(
      extensionContext.value?.workspaceState.get<Context>(`webview:${id}:context`) ??
        ({} as Context)
    )

    let realPost: (data: IpcFromHost<Context, FH>) => void

    const { panel, active, visible, postMessage } = useWebviewPanel(
      id,
      title,
      html,
      {
        viewColumn: column
      },
      {
        retainContextWhenHidden: retain ?? false,
        webviewOptions: {
          enableScripts: true,
          localResourceRoots: [rootUri]
        },
        onDidReceiveMessage(data: string) {
          // logger.silly(`webview ${id} recv ${data.slice(0, 200)}`)

          const msg = JSON.parse(data) as IpcToHost<Context, TH>
          if (msg.__builtin) {
            switch (msg.cmd) {
              case 'requestInit':
                realPost({
                  __builtin: true,
                  cmd: 'initContext',
                  ctx: context.value
                })
                break
              case 'updateContext':
                extensionContext.value?.workspaceState.update(`webview:${id}:context`, msg.ctx)
                sync = true
                context.value = msg.ctx
                sync = false
                break
            }
          } else {
            handler.value(msg)
          }
        }
      }
    )

    realPost = (data: IpcFromHost<Context, FH>) => {
      const datastr = JSON.stringify(data)
      // logger.silly(`webview ${id} send ${datastr.slice(0, 200)}`)
      postMessage(datastr)
    }

    const post = (data: FH) => {
      realPost(data)
    }

    const webRootUri = panel.webview.asWebviewUri(rootUri)

    const htmlUri = vscode.Uri.joinPath(rootUri, 'index.html')
    const htmlContent = (await vscfs.readFile(htmlUri))
      .toString()
      .replaceAll('="./assets', `="${webRootUri.toString()}/assets`)
      .replaceAll('crossorigin href=', 'crossorigin id="vscode-codicon-stylesheet" href=')
      .replaceAll('%{cspSource}', panel.webview.cspSource)

    html.value = htmlContent

    const stopSyncContext = watch(
      context,
      ctx => {
        extensionContext.value?.workspaceState.update(`webview:${id}:context`, ctx)
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

    const onDidDispose: (() => void)[] = []

    panel.onDidDispose(() => {
      realPost = () => {}
      stopSyncContext()
      onDidDispose.forEach(f => f())
    })

    return {
      context,
      handler,
      active,
      visible,
      post,
      onDidDispose
    }
  }
}
