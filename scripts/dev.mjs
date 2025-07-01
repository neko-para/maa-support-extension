import { context as esContext } from 'esbuild'
import path from 'path'
import { createServer as viteWatch } from 'vite'

esContext({
  entryPoints: ['pkgs/extension/src/extension.ts'],
  bundle: true,
  outdir: 'release/out',
  external: ['@maaxyz/maa-node', 'vscode', 'node-gyp/bin/node-gyp.js'],
  platform: 'node',
  sourcemap: true,
  mainFields: ['module', 'main'],
  loader: {
    '.html': 'text'
  }
}).then(ctx => {
  ctx.watch()
})

viteWatch({
  root: path.join(import.meta.dirname, '../pkgs/webview'),
  mode: 'development'
}).then(async server => {
  await server.listen()
  server.printUrls()
})
