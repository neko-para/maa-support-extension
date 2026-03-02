import * as path from 'node:path'
import { build } from 'tsdown'

/**
 *
 * @param {string[]} folders
 */
export async function buildChain(folders) {
  while (folders.length > 0) {
    const folder = folders.shift()
    console.log('build', folder)

    await build({
      config: path.resolve(import.meta.dirname, '..', folder, 'tsdown.config.mts')
    })
  }
}

/**
 *
 * @param {string[]} folders
 */
export async function watchChain(folders) {
  while (folders.length > 0) {
    const folder = folders.shift()
    console.log('watch', folder)

    const { promise, resolve } = Promise.withResolvers()
    build({
      config: path.resolve(import.meta.dirname, '..', folder, 'tsdown.config.mts'),
      watch: true,
      onSuccess: resolve
    })
    await promise
  }
}
