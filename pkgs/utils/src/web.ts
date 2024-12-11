import { JSONParse, JSONStringify } from 'json-with-bigint'
import {
  ShallowRef,
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

// TODO: 看看怎么不抄两份

export function createUseWebView<Context, TH extends IpcRest, FH extends IpcRest>(
  dir: string,
  id: string
) {
  return createSingletonComposable(() => {
    const handler = ref<(data: TH) => void>(() => {})
    const rootUri = vscode.Uri.joinPath(extensionContext.value!.extensionUri, dir)
    const html = ref('loading...')

    let sync = false
    const context = ref<Context>(
      extensionContext.value?.workspaceState.get<Context>(`webview:${id}:context`) ??
        ({} as Context)
    )

    let realPost: (data: IpcFromHost<Context, FH>) => void

    const { view, postMessage } = useWebviewView(id, html, {
      webviewOptions: {
        enableScripts: true,
        localResourceRoots: [rootUri]
      },
      onDidReceiveMessage(data: string) {
        const msg = JSONParse(data) as IpcToHost<Context, TH>
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
    })

    realPost = (data: IpcFromHost<Context, FH>) => {
      postMessage(JSONStringify(data))
    }

    const post = (data: FH) => {
      realPost(data)
    }

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
      post
    }
  })
}

export function createUseWebPanel<Context, TH extends IpcRest, FH extends IpcRest>(
  dir: string,
  id: string,
  retain?: boolean
) {
  return async (title: string, column: vscode.ViewColumn) => {
    const handler = ref<(data: TH) => void>(() => {})
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
          const msg = JSONParse(data) as IpcToHost<Context, TH>
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
      postMessage(JSONStringify(data))
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
      active,
      visible,
      post
    }
  }
}
