import { defineConfig } from 'tsdown'

export default defineConfig([
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
    entry: ['pkgs/maa-tools/src/index.ts', 'pkgs/maa-tools/src/test/worker.ts'],
    outDir: 'pkgs/maa-tools/dist',
    format: 'esm',
    sourcemap: true,
    nodeProtocol: true,
    dts: {
      sourcemap: true
    },
    external: [
      '@maaxyz/maa-node',
      '@nekosu/maa-locale',
      '@nekosu/maa-version-manager',
      '@nekosu/maa-pipeline-manager',
      '@actions/core',
      'jiti',
      'workerpool'
    ],
    outputOptions: {
      banner: chunk => {
        if (chunk.fileName.endsWith('.d.mts')) {
          return '/// <reference types="@maaxyz/maa-node" />'
        } else {
          return ''
        }
      }
    }
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
    external: [
      '@maaxyz/maa-node',
      '@nekosu/maa-locale',
      '@nekosu/maa-tasker',
      'chokidar',
      'jsonc-parser'
    ],
    inputOptions: {
      resolve: {
        mainFields: ['module', 'main']
      }
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
    entry: ['pkgs/maa-locale/src/index.ts'],
    outDir: 'pkgs/maa-locale/dist',
    format: 'esm',
    sourcemap: true,
    nodeProtocol: true,
    dts: {
      sourcemap: true
    }
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
  },
  {
    entry: ['pkgs/prettier-plugin-maafw-sort/src/index.ts'],
    outDir: 'pkgs/prettier-plugin-maafw-sort/dist',
    format: 'esm',
    sourcemap: true,
    nodeProtocol: true,
    dts: {
      sourcemap: true
    },
    external: ['@babel/types', 'prettier', 'prettier/plugins/babel']
  }
])
