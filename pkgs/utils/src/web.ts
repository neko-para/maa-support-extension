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
import { AddressInfo, WebSocketServer } from 'ws'

import { IpcFromHost, IpcFromHostBuiltin, IpcRest, IpcToHost } from '@mse/types'

import { vscfs } from './fs'
import { logger } from './logger'

// TODO: 看看怎么不抄两份

const cspMeta = `<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'none'; font-src %{cspSource}; style-src 'unsafe-inline' %{cspSource}; script-src %{cspSource}; img-src %{cspSource} data:; connect-src %{cspSource} data:;"
/>`

const forwardIframe = (url: string) => {
  return `<head>
  <style>
    body {
      padding: 0;
    }
    iframe {
      position: fixed;
      width: 100%;
      height: 100%;
      border-width: 0;
    }
  </style>
</head>
<iframe src="${url}"></iframe>`
}

export function createUseWebView<Context, TH extends IpcRest, FH extends IpcRest>(
  dir: string,
  index: string,
  id: string,
  dev: boolean
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

    const processMessage = (data: IpcToHost<Context, TH>) => {
      if (data.__builtin) {
        switch (data.cmd) {
          case 'requestInit':
            realPost({
              __builtin: true,
              cmd: 'initContext',
              ctx: context.value
            })
            break
          case 'updateContext':
            extensionContext.value?.workspaceState.update(`webview:${id}:context`, data.ctx)
            sync = true
            context.value = data.ctx
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
            logger.log(data.type, data.message)
            break
        }
      } else {
        handler.value(data)
      }
    }

    const post = (data: FH) => {
      realPost(data)
    }

    const visible = ref(false)
    let focus: (focusCmd: string) => Promise<void>

    if (dev) {
      visible.value = false
      realPost = () => {}

      const server = new WebSocketServer({
        port: 0
      })
      server.on('connection', conn => {
        if (visible.value) {
          logger.error('duplicate websocket connect in!')
          return
        }
        visible.value = true

        conn.on('close', () => {
          visible.value = false
          realPost = data => {
            logger.warn(`webview ${id} data not posted ${JSON.stringify(data).slice(0, 200)}`)
          }
        })

        conn.on('message', data => {
          processMessage(JSON.parse(data.toString()))
        })

        realPost = (data: IpcFromHost<Context, FH>) => {
          const datastr = JSON.stringify(data)
          conn.send(datastr)
        }
      })
      const port = (server.address() as AddressInfo).port
      // const show = () => {
      //   vscode.env.openExternal(vscode.Uri.parse(`http://localhost:5173/${index}?msePort=${port}`))
      // }
      // focus = () => {
      //   return new Promise<void>(resolve => {
      //     if (!visible.value) {
      //       show()
      //       awakeListener.value.push(resolve)
      //     } else {
      //       resolve()
      //     }
      //   })
      // }
      // show()

      const { view } = useWebviewView(id, html, {
        webviewOptions: {
          enableScripts: true
        }
      })

      watch(view, async v => {
        if (v) {
          html.value = forwardIframe(`http://localhost:5173/${index}?msePort=${port}`)

          v.onDidChangeVisibility(e => {
            logger.debug(`webview ${id} change visibility ${v.visible}`)
            visible.value = v.visible
          })
          visible.value = false
        }
      })

      focus = focusCmd => {
        return new Promise<void>(resolve => {
          if (!visible.value) {
            vscode.commands.executeCommand(focusCmd)
            awakeListener.value.push(resolve)
          } else {
            resolve()
          }
        })
      }
    } else {
      const { view, postMessage } = useWebviewView(id, html, {
        webviewOptions: {
          enableScripts: true,
          localResourceRoots: [rootUri]
        },
        onDidReceiveMessage(data: string) {
          processMessage(JSON.parse(data))
        }
      })

      realPost = (data: IpcFromHost<Context, FH>) => {
        const datastr = JSON.stringify(data)
        postMessage(datastr)
      }

      watch(view, async v => {
        if (v) {
          const webRootUri = v.webview.asWebviewUri(rootUri)

          const htmlUri = vscode.Uri.joinPath(rootUri, index + '.html')
          const htmlContent = (await vscfs.readFile(htmlUri))
            .toString()
            .replaceAll('="./assets', `="${webRootUri.toString()}/assets`)
            .replaceAll(
              'rel="stylesheet" crossorigin href=',
              'rel="stylesheet" crossorigin id="vscode-codicon-stylesheet" href='
            )
            .replace(
              '</title>',
              '</title>' + cspMeta.replaceAll('%{cspSource}', v.webview.cspSource)
            )

          html.value = htmlContent

          v.onDidChangeVisibility(e => {
            logger.debug(`webview ${id} change visibility ${v.visible}`)
            visible.value = v.visible
          })
          visible.value = false
        }
      })

      focus = focusCmd => {
        return new Promise<void>(resolve => {
          if (!visible.value) {
            vscode.commands.executeCommand(focusCmd)
            awakeListener.value.push(resolve)
          } else {
            resolve()
          }
        })
      }
    }

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
      awakeListener,
      focus
    }
  })
}

export function createUseWebPanel<Context, TH extends IpcRest, FH extends IpcRest>(
  dir: string,
  index: string,
  id: string,
  dev: boolean,
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

    let awakeResolve: () => void = () => {}
    const awaked = new Promise<void>(resolve => {
      awakeResolve = resolve
    })

    const processMessage = (data: IpcToHost<Context, TH>) => {
      if (data.__builtin) {
        switch (data.cmd) {
          case 'requestInit':
            realPost({
              __builtin: true,
              cmd: 'initContext',
              ctx: context.value
            })
            break
          case 'updateContext':
            extensionContext.value?.workspaceState.update(`webview:${id}:context`, data.ctx)
            sync = true
            context.value = data.ctx
            sync = false
            break
          case 'awake':
            awakeResolve()
            break
          case 'log':
            logger.log(data.type, data.message)
            break
        }
      } else {
        handler.value(data)
      }
    }

    if (dev) {
      const server = new WebSocketServer({
        port: 0
      })
      server.once('connection', conn => {
        conn.on('close', () => {
          realPost = () => {}
          stopSyncContext()
          onDidDispose.forEach(f => f())
        })

        conn.on('message', data => {
          processMessage(JSON.parse(data.toString()))
        })

        realPost = (data: IpcFromHost<Context, FH>) => {
          const datastr = JSON.stringify(data)
          conn.send(datastr)
        }
      })
      const port = (server.address() as AddressInfo).port
      // const show = () => {
      //   vscode.env.openExternal(vscode.Uri.parse(`http://localhost:5173/${index}?msePort=${port}`))
      // }
      // show()

      const { panel } = useWebviewPanel(
        id,
        title,
        html,
        {
          viewColumn: column
        },
        {
          retainContextWhenHidden: retain ?? false,
          webviewOptions: {
            enableScripts: true
          }
        }
      )

      html.value = forwardIframe(`http://localhost:5173/${index}?msePort=${port}`)
      panel.onDidDispose(() => {
        realPost = () => {}
        stopSyncContext()
        onDidDispose.forEach(f => f())
      })
    } else {
      const { panel, postMessage } = useWebviewPanel(
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
            processMessage(JSON.parse(data))
          }
        }
      )

      realPost = (data: IpcFromHost<Context, FH>) => {
        const datastr = JSON.stringify(data)
        // logger.silly(`webview ${id} send ${datastr.slice(0, 200)}`)
        postMessage(datastr)
      }

      const webRootUri = panel.webview.asWebviewUri(rootUri)

      const htmlUri = vscode.Uri.joinPath(rootUri, index + '.html')
      const htmlContent = (await vscfs.readFile(htmlUri))
        .toString()
        .replaceAll('="./assets', `="${webRootUri.toString()}/assets`)
        .replaceAll(
          'rel="stylesheet" crossorigin href=',
          'rel="stylesheet" crossorigin id="vscode-codicon-stylesheet" href='
        )
        .replace(
          '</title>',
          '</title>' + cspMeta.replaceAll('%{cspSource}', panel.webview.cspSource)
        )

      html.value = htmlContent

      panel.onDidDispose(() => {
        realPost = () => {}
        stopSyncContext()
        onDidDispose.forEach(f => f())
      })
    }

    const post = (data: FH) => {
      realPost(data)
    }

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

    return {
      context,
      handler,
      post,
      onDidDispose,
      awaked
    }
  }
}
