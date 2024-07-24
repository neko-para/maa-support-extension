import { context } from 'esbuild'
import { build } from 'vite'

context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outdir: 'release/out',
  external: ['@nekosu/maa-node', 'vscode'],
  platform: 'node',
  sourcemap: true,
  mainFields: ['module', 'main']
}).then(ctx => {
  ctx.watch()
})

build({
  configFile: 'web/vite.config.mts',
  build: {
    watch: true
  }
})
