import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: 'dist',
    format: 'esm',
    sourcemap: true,
    nodeProtocol: true,
    dts: {
      sourcemap: true
    },

    external: ['@babel/types', 'prettier', 'prettier/plugins/babel']
  }
])
