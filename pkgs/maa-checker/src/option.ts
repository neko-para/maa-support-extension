import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import type { LocaleType } from '@mse/locale'
import type { AbsolutePath } from '@mse/pipeline-manager'

import pkg from '../package.json'

export type ProgramOption = {
  interfacePath: AbsolutePath
  rawMode: boolean
  gz: boolean
  githubMode: boolean
  repoFolder: AbsolutePath

  command: 'check' | 'reco'

  // check
  locale: LocaleType
  ignoreTypes: string[]
  errorTypes: string[]

  // reco
  maaVersion: string
  maaCache: AbsolutePath
  job: number
  maxNodePerJob: number
  controller: string
  resource: string
  imagesRaw: string[]
  images: AbsolutePath[]
  nodes: string[]
  printHit: boolean
  printNotHit: boolean
}

const allTypes = [
  'conflict-task',
  'duplicate-next',
  'unknown-task',
  'dynamic-image',
  'image-path-back-slash',
  'image-path-dot-slash',
  'image-path-missing-png',
  'unknown-image',
  'unknown-anchor',
  'unknown-attr',
  'mpe-config',
  'int-conflict-controller',
  'int-unknown-controller',
  'int-conflict-resource',
  'int-unknown-resource',
  'int-conflict-option',
  'int-unknown-option',
  'int-conflict-case',
  'int-unknown-case',
  'int-switch-name-invalid',
  'int-switch-missing',
  'int-switch-should-fixed',
  'int-unknown-entry-task',
  'int-override-unknown-task'
]

function defaultVersion() {
  return pkg.devDependencies['@maaxyz/maa-node']
}

function defaultCacheFolder() {
  return path.join(os.homedir(), '.maa-checker') as AbsolutePath
}

export function printUsage() {
  console.log(`Usage: npx ${pkg.name} <interface path> [command] [options...]

Command:
    check                   Check project and output diagnostic
    reco                    Batch performing reco

Options:
  --raw                     Output json
  --gz                      Output json with gz compress and base64
  --github=<repo>           Output github actions compatible warning & error messages, with repository folder <repo>.
  --repo=<repo>             Set repository folder <repo>
  --help                    Print usage

Option for check:
  --locale=<lang>           Use locale <lang>
                                Known locales: zh, en
  --ignore=<type>           Ignore <type>
                                Known types: ${allTypes.join(', ')}
  --error=<type>            Treat <type> as error

Option for reco:
  --maa-version=<ver>       Use MaaFw version <ver>. Default: ${defaultVersion()}
  --maa-cache=<dir>         Use MaaFw cache folder <dir>. Default: ${defaultCacheFolder()}
  --job=<job>               Maximum parallel job <job>. Default: ${os.cpus().length}
  --max-node-per-job=<cnt>  Maximum count <cnt> of nodes batched in one job. Default: auto
  --controller=<ctrl>       Use controller <ctrl> for attach_resource_path
  --resource=<res>          Use resource <res>
  --image=<img>             Perform reco on <img>
  --image-folder=<dir>      Glob .png under <dir>, recursively
  --node=<node>             Perform reco of node <node>
  --node-list=<file>        Parse nodes from <file>. Seperated with spaces or newlines
  --print-hit               Print hits images
  --print-not-hit           Print not hits images
`)
}

export async function parseOption(): Promise<ProgramOption | null> {
  const option: ProgramOption = {
    interfacePath: path.join(process.cwd(), 'interface.json') as AbsolutePath,
    rawMode: false,
    gz: false,
    githubMode: false,
    repoFolder: process.cwd() as AbsolutePath,

    command: 'check',

    locale: 'en',
    ignoreTypes: [],
    errorTypes: [],

    maaVersion: defaultVersion(),
    maaCache: defaultCacheFolder(),
    job: os.cpus().length,
    maxNodePerJob: 0,
    controller: '',
    resource: '',
    imagesRaw: [],
    images: [],
    nodes: [],
    printHit: false,
    printNotHit: false
  }

  if (process.argv.length < 3) {
    return null
  }

  option.interfacePath = path.resolve(process.argv[2]) as AbsolutePath

  const args = process.argv.slice(3)
  if (args.length > 0 && ['check', 'reco'].includes(args[0])) {
    option.command = args.shift() as 'check' | 'reco'
  }

  const regex = /^--([a-z-]+)(?:=(.+))?$/
  for (const opt of args) {
    let match = regex.exec(opt)
    if (!match) {
      continue
    }
    switch (match[1]) {
      case 'help':
        printUsage()
        return null
      case 'raw':
        option.rawMode = true
        break
      case 'gz':
        option.gz = true
        break
      case 'github':
        option.githubMode = true
        if (match[2]) {
          option.repoFolder = path.resolve(match[2]) as AbsolutePath
        }
        break
      case 'repo':
        if (match[2]) {
          option.repoFolder = path.resolve(match[2]) as AbsolutePath
        }
        break

      case 'locale':
        if (match[2] && ['zh', 'en'].includes(match[2])) {
          option.locale = match[2] as LocaleType
        }
        break
      case 'ignore':
        if (match[2] && allTypes.includes(match[2])) {
          option.ignoreTypes.push(match[2])
        }
        break
      case 'error':
        if (match[2] && allTypes.includes(match[2])) {
          option.errorTypes.push(match[2])
        }
        break

      case 'maa-version':
        if (match[2]) {
          option.maaVersion = match[2]
        }
        break
      case 'maa-cache':
        if (match[2]) {
          option.maaCache = path.resolve(match[2]) as AbsolutePath
        }
        break
      case 'job':
        if (match[2]) {
          const val = parseInt(match[2])
          if (!isNaN(val) && val > 0) {
            option.job = val
          }
        }
        break
      case 'max-node-per-job':
        if (match[2]) {
          const val = parseInt(match[2])
          if (!isNaN(val) && val > 0) {
            option.maxNodePerJob = val
          }
        }
        break
      case 'controller':
        if (match[2]) {
          option.controller = match[2]
        }
        break
      case 'resource':
        if (match[2]) {
          option.resource = match[2]
        }
        break
      case 'image':
        if (match[2]) {
          option.imagesRaw.push(match[2])
          option.images.push(path.resolve(match[2]) as AbsolutePath)
        }
        break
      case 'image-folder':
        if (match[2]) {
          const folder = path.resolve(match[2])
          for await (const file of fs.glob('**/*.png', {
            cwd: folder
          })) {
            option.imagesRaw.push(path.join(match[2], file))
            option.images.push(path.resolve(folder, file) as AbsolutePath)
          }
        }
        break
      case 'node':
        if (match[2]) {
          option.nodes.push(match[2])
        }
        break
      case 'node-list':
        if (match[2] && existsSync(match[2])) {
          const nodeList = await fs.readFile(match[2], 'utf8')
          const nodes = nodeList
            .split(/[ \n]+/)
            .map(node => node.trim())
            .filter(node => !!node)
          option.nodes.push(...nodes)
        }
        break
      case 'print-hit':
        option.printHit = true
        break
      case 'print-not-hit':
        option.printNotHit = true
        break
    }
  }

  return option
}
