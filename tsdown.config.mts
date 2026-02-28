import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    cwd: 'pkgs/extension',
    entry: ['src/extension.ts'],
    outDir: '../../release/out',
    format: 'esm',
    sourcemap: true,
    nodeProtocol: true,
    loader: {
      html: 'text'
    },
    external: ['vscode', '@maaxyz/maa-node'],
    inlineOnly: false,
    inputOptions: {
      resolve: {
        mainFields: ['module', 'main']
      }
    }
  },
  {
    entry: ['pkgs/maa-server/src/index.ts'],
    outDir: 'release/server',
    format: 'esm',
    sourcemap: true,
    nodeProtocol: true,
    external: ['@maaxyz/maa-node'],
    inlineOnly: false
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
    external: [
      '@maaxyz/maa-node',
      '@nekosu/maa-version-manager',
      '@nekosu/maa-pipeline-manager',
      '@actions/core',
      'workerpool'
    ]
  },

  {
    entry: ['pkgs/maa-pipeline-manager/src/index.ts'],
    outDir: 'pkgs/maa-pipeline-manager/dist',
    format: 'esm',
    sourcemap: true,
    nodeProtocol: true,
    dts: {
      sourcemap: true
    },
    external: ['@maaxyz/maa-node', '@nekosu/maa-tasker', 'chokidar', 'jsonc-parser'],
    inputOptions: {
      resolve: {
        mainFields: ['module', 'main']
      }
    }
  },
  {
    entry: ['pkgs/maa-tasker/src/index.ts'],
    outDir: 'pkgs/maa-tasker/dist',
    format: 'esm',
    sourcemap: true,
    nodeProtocol: true,
    dts: {
      sourcemap: true
    },
    external: ['@nekosu/simple-parser']
  },
  {
    entry: ['pkgs/maa-version-manager/src/index.ts'],
    outDir: 'pkgs/maa-version-manager/dist',
    format: 'esm',
    sourcemap: true,
    nodeProtocol: true,
    dts: {
      sourcemap: true
    },
    external: ['pacote', 'proper-lockfile', 'semver/functions/compare.js']
  },
  {
    entry: ['pkgs/simple-parser/src/index.ts'],
    outDir: 'pkgs/simple-parser/dist',
    format: 'esm',
    sourcemap: true,
    nodeProtocol: true,
    dts: {
      sourcemap: true
    }
  }
])
