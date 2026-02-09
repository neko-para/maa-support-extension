import * as core from '@actions/core'
import { existsSync, statSync } from 'node:fs'
import * as path from 'node:path'

import { setLocale } from '@mse/locale'
import {
  type AbsolutePath,
  FsContentLoader,
  FsContentWatcher,
  InterfaceBundle
} from '@mse/pipeline-manager'

import { performCheck } from './check'
import { parseOption, printUsage } from './option'
import { performReco } from './reco'
import { console2 } from './utils'

async function main() {
  console2.time('checker')

  const option = await parseOption()
  if (!option) {
    printUsage()
    return false
  }

  console2.timeLog('checker', 'parse option done')

  setLocale(option.locale)

  if (existsSync(option.interfacePath) && statSync(option.interfacePath).isDirectory()) {
    option.interfacePath = path.join(option.interfacePath, 'interface.json') as AbsolutePath
  }

  if (!existsSync(option.interfacePath)) {
    if (option.githubMode) {
      core.error(`${option.interfacePath} not found`)
    } else {
      console.error(`${option.interfacePath} not found`)
    }
    return false
  }

  const bundle = new InterfaceBundle(
    new FsContentLoader(),
    new FsContentWatcher(),
    false,
    path.dirname(option.interfacePath),
    path.basename(option.interfacePath)
  )
  await bundle.load()
  await bundle.flush(false) // 刷下 imports

  console2.timeLog('checker', 'bundle loaded')

  if (option.command === 'check') {
    return performCheck(option, bundle)
  } else if (option.command === 'reco') {
    return performReco(option, bundle)
  } else {
    return false
  }
}

main().then(succ => {
  process.exit(succ ? 0 : 1)
})
