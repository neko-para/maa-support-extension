import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { build } from 'tsdown'

const iconByteLimit = 1024 * 1024
const iconMinSize = 128

/**
 * 市场要求图标为不小于 128x128 的 PNG 且不超过 1 MB，超标时发布会被市场服务端拒绝
 * @param {string} releaseDir
 */
export async function verifyExtensionIcon(releaseDir) {
  const manifest = JSON.parse(await fs.readFile(path.join(releaseDir, 'package.json'), 'utf8'))
  if (!manifest.icon) {
    return
  }

  const buffer = await fs.readFile(path.join(releaseDir, manifest.icon))
  if (buffer.length > iconByteLimit) {
    throw new Error(
      `Extension icon ${manifest.icon} is ${buffer.length} bytes, over the ${iconByteLimit} bytes limit`
    )
  }
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error(`Extension icon ${manifest.icon} is not a PNG file`)
  }

  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  if (width < iconMinSize || height < iconMinSize) {
    throw new Error(
      `Extension icon ${manifest.icon} is ${width}x${height}, smaller than ${iconMinSize}x${iconMinSize}`
    )
  }
}

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
