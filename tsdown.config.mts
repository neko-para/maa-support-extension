import { defineConfig } from 'tsdown'

const banner =
  'import __path from "node:path"; import __url from "node:url"; const __filename = __url.fileURLToPath(import.meta.url); const __dirname = __path.dirname(__filename);'

export default defineConfig([
  {
    entry: ['pkgs/extension/src/extension.ts'],
    outDir: 'release/out',
    format: 'esm',
    sourcemap: true,
    nodeProtocol: true,
    loader: {
      html: 'text'
    },
    deps: {
      neverBundle: ['vscode', '@maaxyz/maa-node'],
      onlyAllowBundle: false
    },
    inputOptions: {
      resolve: {
        mainFields: ['module', 'main']
      }
    },
    outputOptions: {
      banner
    }
  },
  {
    entry: ['pkgs/maa-server/src/index.ts'],
    outDir: 'release/server',
    format: 'esm',
    sourcemap: true,
    nodeProtocol: true,
    deps: {
      neverBundle: ['@maaxyz/maa-node'],
      onlyAllowBundle: false
    }
  },
  {
    entry: ['pkgs/maa-checker/src/main.ts', 'pkgs/maa-checker/src/reco/worker.ts'],
    outDir: 'pkgs/maa-checker/dist',
    format: 'esm',
    sourcemap: true,
    nodeProtocol: true,
    dts: {
      sourcemap: true
    },
    deps: {
      neverBundle: ['@maaxyz/maa-node'],
      onlyAllowBundle: false
    },
    inputOptions: {
      resolve: {
        mainFields: ['module', 'main']
      }
    },
    outputOptions: {
      banner
    }
  }
])
