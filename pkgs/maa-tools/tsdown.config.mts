import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/test/worker.ts', 'src/pm.ts'],
    outDir: 'dist',
    format: 'esm',
    sourcemap: true,
    nodeProtocol: true,
    dts: {
      sourcemap: true
    },

    outputOptions: {
      banner: chunk => {
        if (chunk.fileName.endsWith('.d.mts')) {
          return '/// <reference types="@maaxyz/maa-node" />'
        } else {
          return ''
        }
      }
    }
  }
])
