import { build } from 'esbuild'

build({
  entryPoints: ['pkgs/extension/src/extension.ts'],
  bundle: true,
  outdir: 'release/out',
  external: ['@maaxyz/maa-node', 'vscode'],
  platform: 'node',
  sourcemap: true
})
