import { context as esContext } from 'esbuild'
import path from 'path'
import { build as viteBuild } from 'vite'

esContext({
  entryPoints: ['pkgs/extension/src/extension.ts'],
  bundle: true,
  outdir: 'release/out',
  external: ['@maaxyz/maa-node', 'vscode'],
  platform: 'node',
  sourcemap: true
}).then(ctx => {
  ctx.watch()
})

viteBuild({
  root: path.join(import.meta.dirname, '../pkgs/controlPanel'),
  build: {
    watch: {}
  }
})
