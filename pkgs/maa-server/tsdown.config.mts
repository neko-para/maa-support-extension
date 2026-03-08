import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: '../../release/server',
    format: 'esm',
    sourcemap: true,
    nodeProtocol: true,
    deps: {
      neverBundle: ['@maaxyz/maa-node'],
      onlyAllowBundle: false
    }
  }
])
