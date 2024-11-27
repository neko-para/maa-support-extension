import { build as esBuild } from 'esbuild'
import { build as viteBuild } from 'vite'

esBuild({
  entryPoints: ['pkgs/extension/src/extension.ts'],
  bundle: true,
  outdir: 'release/out',
  external: ['@maaxyz/maa-node', 'vscode'],
  platform: 'node',
  sourcemap: true
})

viteBuild({
  root: path.join(import.meta.dirname, '../pkgs/controlPanel')
})
