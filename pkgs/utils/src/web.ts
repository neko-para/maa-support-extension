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

export function createUseWebView<Context extends {}, TH extends IpcRest, FH extends IpcRest>(
  dir: string,
  id: string,
  initContext: Context
) {
  return createSingletonComposable(async () => {
    const handler = ref<(data: TH) => void>(() => {})
    const rootUri = vscode.Uri.joinPath(extensionContext.value!.extensionUri, dir)
    const html = ref('loading...')

    let realPost: (data: IpcFromHost<Context, FH>) => void

    const { view, postMessage } = useWebviewView(id, html, {
      webviewOptions: {
        enableScripts: true,
        localResourceRoots: [rootUri]
      },
      onDidReceiveMessage(data: string) {
        const msg = JSON.parse(data) as IpcToHost<Context, TH>
        // console.log('[host] recv', msg)
        if (msg.__builtin) {
          switch (msg.cmd) {
            case 'requestInit':
              realPost({
                __builtin: true,
                cmd: 'initContext',
                ctx:
                  extensionContext.value?.workspaceState.get<Context>(`webview:${id}:context`) ??
                  initContext
              } satisfies IpcFromHostBuiltin<Context>)
              break
            case 'updateContext':
              extensionContext.value?.workspaceState.update(`webview:${id}:context`, msg.ctx)
              break
          }
        } else {
          handler.value(msg)
        }
      }
    })

    realPost = (data: IpcFromHost<Context, FH>) => {
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

    return {
      handler,
      post
    }
  })
}
