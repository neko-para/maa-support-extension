import compressing from 'compressing'
import { close, constants, existsSync, open } from 'fs'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as vscode from 'vscode'

import type { Manifest } from './npm'

export let maa: typeof import('@nekosu/maa-node')

const maaVersion = '2.1.0'
const registryUrl = 'https://registry.npmmirror.com/'

const rootPackage = '@nekosu/maa-node'
const platformPackage = `@nekosu/maa-node-${process.platform}-${process.arch}`

async function fetchManifest(pkg: string) {
  return (await (await fetch(`${registryUrl}${encodeURIComponent(pkg)}`)).json()) as Manifest
}

async function fetchTarball(pkg: string, ver: string) {
  const reg = await fetchManifest(pkg)
  if (!(ver in reg.versions)) {
    return null
  }
  const regver = reg.versions[ver]
  return await (await fetch(regver.dist.tarball)).arrayBuffer()
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

  const excludeTag = path.join(dir, '.lock')

  const block = await new Promise<boolean>(resolve => {
    open(excludeTag, constants.O_CREAT | constants.O_EXCL, (err, fd) => {
      if (err) {
        resolve(false)
      } else {
        close(fd)
        resolve(true)
      }
    })
  })

  if (!block) {
    vscode.window.showErrorMessage('Another instance of extension detected')
    return false
  }

  const rootVerFile = path.join(dir, 'maa-node.version')
  const platVerFile = path.join(dir, 'maa-node-platform.version')

  const curRootVer = existsSync(rootVerFile) ? await fs.readFile(rootVerFile, 'utf8') : null
  const curPlatVer = existsSync(platVerFile) ? await fs.readFile(platVerFile, 'utf8') : null

  const checkRoot = async () => {
    if (curRootVer !== maaVersion) {
      console.log('current', curRootVer, 'expect', maaVersion)
      if (
        !(await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `downloading ${rootPackage}@${maaVersion}`
          },
          () => {
            return releaseTarball(rootPackage, maaVersion, dir)
          }
        ))
      ) {
        return false
      }
      await fs.writeFile(rootVerFile, maaVersion)
    }
    return true
  }

  const checkPlat = async () => {
    if (curPlatVer !== maaVersion) {
      console.log('current', curPlatVer, 'expect', maaVersion)
      if (
        !(await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `downloading ${platformPackage}@${maaVersion}`
          },
          () => {
            return releaseTarball(platformPackage, maaVersion, dir)
          }
        ))
      ) {
        return false
      }
      await fs.writeFile(platVerFile, maaVersion)
    }
    return true
  }

  const [gotRoot, gotPlat] = await Promise.all([checkRoot(), checkPlat()])

  await fs.rm(excludeTag)

  if (!(gotRoot && gotPlat)) {
    return false
  }

  const oldPaths = (process.env['NODE_PATH'] ?? '').split(path.delimiter).filter(x => x)
  process.env['NODE_PATH'] = [dir, ...oldPaths].join(path.delimiter)

  maa = require('@nekosu/maa-node')

  return true
}
