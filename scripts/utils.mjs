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

    const cwd = path.resolve(import.meta.dirname, '..', folder)
    await build({
      cwd,
      config: true
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

    const cwd = path.resolve(import.meta.dirname, '..', folder)
    const { promise, resolve } = Promise.withResolvers()
    build({
      cwd,
      config: true,
      watch: true,
      onSuccess: resolve
    })
    await promise
  }
}
