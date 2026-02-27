import path from 'node:path'
import { build } from 'tsdown'
import { build as viteBuild } from 'vite'

build({
  config: path.resolve(import.meta.dirname, '../tsdown.config.mts'),
  minify: true
})

viteBuild({
  root: path.join(import.meta.dirname, '../pkgs/webview')
})
