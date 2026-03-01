import { context as esContext } from 'esbuild'
import path from 'node:path'
import { build } from 'tsdown'
import { build as viteBuild } from 'vite'

build({
  config: path.resolve(import.meta.dirname, '../tsdown.config.mts'),
  watch: true,
  onSuccess: () => {
    esContext({
      entryPoints: ['pkgs/extension/src/extension.ts'],
      bundle: true,
      outdir: 'release/out',
      external: ['@maaxyz/maa-node', 'vscode', 'node-gyp/bin/node-gyp.js'],
      platform: 'node',
      format: 'esm',
      outExtension: {
        '.js': '.mjs'
      },
      sourcemap: true,
      mainFields: ['module', 'main'],
      loader: {
        '.html': 'text'
      },
      inject: ['scripts/cjs-shim.ts']
    }).then(ctx => {
      ctx.watch()
    })
  }
})

viteBuild({
  root: path.join(import.meta.dirname, '../pkgs/webview'),
  build: {
    minify: false,
    watch: {}
  }
})
