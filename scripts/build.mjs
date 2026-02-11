import { build as esBuild } from 'esbuild'
import path from 'path'
import { build as viteBuild } from 'vite'

esBuild({
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
})

esBuild({
  entryPoints: ['pkgs/maa-server/src/index.ts'],
  bundle: true,
  outdir: 'release/server',
  external: ['@maaxyz/maa-node'],
  platform: 'node',
  sourcemap: true
})

esBuild({
  entryPoints: ['pkgs/maa-checker/src/main.ts', 'pkgs/maa-checker/src/reco/worker.ts'],
  bundle: true,
  outdir: 'pkgs/maa-checker/dist',
  external: ['@maaxyz/maa-node', 'node-gyp/bin/node-gyp.js'],
  platform: 'node',
  sourcemap: true,
  mainFields: ['module', 'main']
})

viteBuild({
  root: path.join(import.meta.dirname, '../pkgs/webview')
})
