import { defineConfig } from 'tsdown'

const bundledDependencies = [
  '@nekosu/maa-pipeline-manager',
  '@nekosu/maa-server-proto',
  '@nekosu/maa-types',
  'semver',
  'source-map-support',
  'uuid',
  'vscode-jsonrpc'
]

export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: 'dist',
    format: 'esm',
    sourcemap: true,
    nodeProtocol: true,
    deps: {
      neverBundle: ['@maaxyz/maa-node'],
      alwaysBundle: id =>
        bundledDependencies.some(
          dependency => id === dependency || id.startsWith(`${dependency}/`)
        ),
      onlyAllowBundle: false
    }
  }
])
