import { build } from 'esbuild'

build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outdir: 'release/out',
  external: ['@nekosu/maa-node', 'vscode'],
  platform: 'node',
  sourcemap: true,
  mainFields: ['module', 'main']
})
