import * as path from 'node:path'
import { build } from 'tsdown'
import { createServer as viteWatch } from 'vite'

build({
  config: path.resolve(import.meta.dirname, '../tsdown.config.mts'),
  watch: true
})

viteWatch({
  root: path.join(import.meta.dirname, '../pkgs/webview'),
  mode: 'development'
}).then(async server => {
  await server.listen()
  server.printUrls()
})
