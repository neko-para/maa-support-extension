import { build as esBuild, context as esContext } from 'esbuild'
import * as path from 'node:path'
import { build as viteBuild, createServer as viteWatch } from 'vite'

/**
 *
 * @param {import('esbuild').BuildOptions} option
 * @param {'build' | 'watch'} mode
 */
function dispatchEs(option, mode) {
  if (mode === 'build') {
    esBuild(option)
  } else {
    esContext(option).then(ctx => ctx.watch())
  }
}

/**
 *
 * @param {string} configPath
 * @param {'build' | 'watch' | 'dev'} mode
 */
function dispatchVite(configPath, mode) {
  if (mode === 'build') {
    viteBuild({
      root: path.join(import.meta.dirname, configPath)
    })
  } else if (mode === 'watch') {
    viteBuild({
      root: path.join(import.meta.dirname, configPath),
      build: {
        minify: false,
        watch: {}
      }
    })
  } else {
    viteWatch({
      root: path.join(import.meta.dirname, configPath),
      mode: 'development'
    }).then(async server => {
      await server.listen()
      server.printUrls()
    })
  }
}

/**
 *
 * @param {'build' | 'watch'} mode
 */
export function buildExtension(mode) {
  dispatchEs(
    {
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
    },
    mode
  )
}

/**
 *
 * @param {'build' | 'watch'} mode
 */
export function buildSupport(mode) {
  return dispatchEs(
    {
      entryPoints: ['pkgs/maa-support/src/index.ts'],
      bundle: true,
      outdir: 'release/support',
      external: ['@maaxyz/maa-node', 'node-gyp/bin/node-gyp.js'],
      platform: 'node',
      sourcemap: true,
      mainFields: ['module', 'main']
    },
    mode
  )
}

/**
 * @param {'build' | 'watch' | 'dev'} mode
 */
export function buildSupportWeb(mode) {
  return dispatchVite('../pkgs/maa-support-webview', mode)
}
