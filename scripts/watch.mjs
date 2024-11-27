import { context } from 'esbuild'

context({
  entryPoints: ['pkgs/extension/src/extension.ts'],
  bundle: true,
  outdir: 'release/out',
  external: ['@maaxyz/maa-node', 'vscode'],
  platform: 'node',
  sourcemap: true
}).then(ctx => {
  ctx.watch()
})
