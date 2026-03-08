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
    deps: {
      neverBundle: ['vscode', '@maaxyz/maa-node'],
      onlyAllowBundle: false
    },
    inputOptions: {
      resolve: {
        mainFields: ['module', 'main']
      }
    }
  }
])
