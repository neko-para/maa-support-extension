import axios from 'axios'
import compressing from 'compressing'
import { close, constants, existsSync, open } from 'fs'
import * as fs from 'fs/promises'
import * as path from 'path'
import lock from 'proper-lockfile'
import * as vscode from 'vscode'

import type { Manifest } from './npm'

export let maa: typeof import('@nekosu/maa-node')

const maaVersion = '2.1.1'
const registryUrl = 'https://registry.npmmirror.com/'

const rootPackage = '@nekosu/maa-node'
const platformPackage = `@nekosu/maa-node-${process.platform}-${process.arch}`

async function performDownload(url: string, title: string) {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title
    },
    async progress => {
      return (
        await axios({
          url,
          responseType: 'arraybuffer',
          onDownloadProgress(progressEvent) {
            if (progressEvent.total) {
              progress.report({
                increment: (progressEvent.bytes / progressEvent.total) * 100,
                message: `${((progressEvent.loaded / progressEvent.total) * 100).toFixed(1)}%`
              })
            }
          }
        })
      ).data as ArrayBuffer
    }
  )
}

async function fetchManifest(pkg: string) {
  return (await (await fetch(`${registryUrl}${encodeURIComponent(pkg)}`)).json()) as Manifest
}

async function fetchTarball(pkg: string, ver: string) {
  const reg = await fetchManifest(pkg)
  if (!(ver in reg.versions)) {
    return null
  }
  const regver = reg.versions[ver]
  return await performDownload(regver.dist.tarball, `Downloading ${pkg}@${ver}`)
}

async function releaseTarball(pkg: string, ver: string, dir: string) {
  const buf = await fetchTarball(pkg, ver)
  if (!buf) {
    console.log('download tarball failed')
    return false
  }
  const cacheDir = path.join(dir, '.cache', pkg)
  const srcDir = path.join(cacheDir, 'package')
  const destDir = path.join(dir, pkg)

  await fs.mkdir(cacheDir, { recursive: true })
  await compressing.tgz.uncompress(Buffer.from(buf), cacheDir)

  if (existsSync(destDir)) {
    console.log('dest exists, removing')
    await fs.rm(destDir, { recursive: true })
  } else {
    console.log('dest not exists, making prefix')
    await fs.mkdir(destDir, { recursive: true })
    await fs.rmdir(destDir)
  }
  await fs.rename(srcDir, destDir)
  return true
}

export async function setupMaa(dir: string) {
  await fs.mkdir(dir, { recursive: true })

  const release = await lock.lock(dir).catch(err => {
    console.log(err)
    return null
  })

  if (!release) {
    vscode.window.showErrorMessage(
      'Another instance of extension detected.\nTry closing other VSCode window and reopen this window later.'
    )
    return false
  }

  const rootVerFile = path.join(dir, 'maa-node.version')
  const platVerFile = path.join(dir, 'maa-node-platform.version')

  const curRootVer = existsSync(rootVerFile) ? await fs.readFile(rootVerFile, 'utf8') : null
  const curPlatVer = existsSync(platVerFile) ? await fs.readFile(platVerFile, 'utf8') : null

  const checkRoot = async () => {
    if (curRootVer !== maaVersion) {
      console.log('current', curRootVer, 'expect', maaVersion)
      if (!(await releaseTarball(rootPackage, maaVersion, dir))) {
        return false
      }
      await fs.writeFile(rootVerFile, maaVersion)
    }
    return true
  }

  const checkPlat = async () => {
    if (curPlatVer !== maaVersion) {
      console.log('current', curPlatVer, 'expect', maaVersion)
      if (!(await releaseTarball(platformPackage, maaVersion, dir))) {
        return false
      }
      await fs.writeFile(platVerFile, maaVersion)
    }
    return true
  }

  const [gotRoot, gotPlat] = await Promise.all([checkRoot(), checkPlat()])

  await release()

  if (!(gotRoot && gotPlat)) {
    return false
  }

  module.paths.push(dir)

  maa = require('@nekosu/maa-node')

  return true
}
