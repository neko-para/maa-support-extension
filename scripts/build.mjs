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

viteBuild({
  root: path.join(import.meta.dirname, '../pkgs/webview')
})
