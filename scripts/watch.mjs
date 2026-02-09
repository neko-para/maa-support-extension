import { context as esContext } from 'esbuild'
import path from 'path'
import { build as viteBuild } from 'vite'

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

esContext({
  entryPoints: ['pkgs/maa-server/src/index.ts'],
  bundle: true,
  outdir: 'release/server',
  external: ['@maaxyz/maa-node'],
  platform: 'node',
  sourcemap: true
}).then(ctx => {
  ctx.watch()
})

esContext({
  entryPoints: ['pkgs/maa-checker/src/main.ts', 'pkgs/maa-checker/src/recoWorker.ts'],
  bundle: true,
  outdir: 'pkgs/maa-checker/dist',
  external: ['@maaxyz/maa-node', 'node-gyp/bin/node-gyp.js'],
  platform: 'node',
  sourcemap: true,
  mainFields: ['module', 'main']
}).then(ctx => {
  ctx.watch()
})

viteBuild({
  root: path.join(import.meta.dirname, '../pkgs/webview'),
  build: {
    minify: false,
    watch: {}
  }
})
