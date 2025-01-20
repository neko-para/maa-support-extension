import { rpcSetup } from '../uni/rpc'
import { withResolvers } from '../uni/utils'
import { makeAdapter } from './rpc'

export async function setupDevelop(injectPlayground = true) {
  if (injectPlayground) {
    await import('@vscode-elements/webview-playground')
    document.body.append(document.createElement('vscode-dev-toolbar'))
    document.body.style.padding = '0'
  }

  const [openedPro, openedRes] = withResolvers()
  const urlParams = new URLSearchParams(window.location.search)
  let port = parseInt(urlParams.get('vwp') ?? '8080')
  if (isNaN(port)) {
    port = 8080
  }
  const socket = new WebSocket(`ws://127.0.0.1:${port}`)
  socket.onopen = () => {
    openedRes()
  }
  socket.onclose = () => {
    window.close()
  }

  await openedPro

  return rpcSetup(async () => 0, ...makeAdapter(socket))
}
