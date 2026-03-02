import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['src/extension.ts'],
    outDir: '../../release/out',
    format: 'esm',
    sourcemap: true,
    nodeProtocol: true,
    loader: {
      html: 'text'
    },
    shims: true,
    external: ['vscode', '@maaxyz/maa-node'],
    inlineOnly: false,
    inputOptions: {
      resolve: {
        mainFields: ['module', 'main']
      }
    }
  }
])
