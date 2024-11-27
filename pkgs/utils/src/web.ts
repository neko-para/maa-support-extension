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

export function createUseWebView<HostContext, WebvContext, TH extends IpcRest, FH extends IpcRest>(
  dir: string,
  id: string
) {
  return createSingletonComposable(() => {
    const handler = ref<(data: TH) => void>(() => {})
    const rootUri = vscode.Uri.joinPath(extensionContext.value!.extensionUri, dir)
    const html = ref('loading...')

    const hostContext = ref<HostContext>(
      extensionContext.value?.workspaceState.get<HostContext>(`webview:${id}:hostContext`) ??
        ({} as HostContext)
    )
    const webvContext = ref<WebvContext>(
      extensionContext.value?.workspaceState.get<WebvContext>(`webview:${id}:webvContext`) ??
        ({} as WebvContext)
    )

    let realPost: (data: IpcFromHost<HostContext, FH>) => void

    const { view, postMessage } = useWebviewView(id, html, {
      webviewOptions: {
        enableScripts: true,
        localResourceRoots: [rootUri]
      },
      onDidReceiveMessage(data: string) {
        const msg = JSON.parse(data) as IpcToHost<WebvContext, TH>
        // console.log('[host] recv', msg)
        if (msg.__builtin) {
          switch (msg.cmd) {
            case 'requestInit':
              realPost({
                __builtin: true,
                cmd: 'updateContext',
                ctx: hostContext.value
              })
              realPost({
                __builtin: true,
                cmd: 'inited'
              })
              break
            case 'updateContext':
              extensionContext.value?.workspaceState.update(`webview:${id}:webvContext`, msg.ctx)
              webvContext.value = msg.ctx
              break
          }
        } else {
          handler.value(msg)
        }
      }
    })

    realPost = (data: IpcFromHost<HostContext, FH>) => {
      // console.log('[host] post', data)
      postMessage(JSON.stringify(data))
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
      hostContext,
      ctx => {
        extensionContext.value?.workspaceState.update(`webview:${id}:hostContext`, ctx)
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

    return {
      hostContext,
      webvContext,
      handler,
      post
    }
  })
}
