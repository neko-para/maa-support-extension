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
    external: ['vscode', '@maaxyz/maa-node'],
    noExternal: ['@nekosu/maa-version-manager', '@nekosu/maa-tasker'],
    inlineOnly: false,
    inputOptions: {
      resolve: {
        mainFields: ['module', 'main']
      }
    }
  }
])
