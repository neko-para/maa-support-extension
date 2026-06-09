import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/runtime/index.ts'],
    outDir: 'dist',
    format: 'esm',
    sourcemap: true,
    nodeProtocol: true,
    dts: {
      sourcemap: true
    },
    inputOptions: {
      resolve: {
        mainFields: ['module', 'main']
      }
    }
  }
])
