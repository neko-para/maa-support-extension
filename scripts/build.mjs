import { build } from 'esbuild'
import { build as vbuild } from 'vite'

build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outdir: 'release/out',
  external: ['@nekosu/maa-node', 'vscode'],
  platform: 'node',
  sourcemap: true,
  mainFields: ['module', 'main']
})

vbuild({
  configFile: 'web/vite.config.mts'
})
