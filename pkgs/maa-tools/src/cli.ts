import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'

import { setLocale } from '@nekosu/maa-locale'

import pkg from '../package.json'
import { runCheck } from './check'
import { runTest } from './test'
import type { FullConfig } from './types/config'
import { loadConfig } from './utils/config'

const defaultConfig = `import type { FullConfig } from '${pkg.name}'

const config: FullConfig = {
  cwd: import.meta.dirname,
  maaVersion: 'latest',
  interfacePath: 'assets/interface.json',
  check: {},
}

export default config
`

export async function runCli(cmd: string, cfg: string | FullConfig) {
  if (cmd === 'init') {
    if (!existsSync('maatools.config.mts')) {
      await fs.writeFile('maatools.config.mts', defaultConfig)
    } else {
      console.error('maatools.config.mts exists')
    }
    return true
  }

  if (typeof cfg === 'string') {
    const resolvedCfg = await loadConfig(cfg)
    if (!resolvedCfg) {
      console.error(`load ${cfg} failed`)
      return false
    }
    cfg = resolvedCfg
  }
  if (process.env['GITHUB_ACTIONS']) {
    if (!cfg.mode) {
      cfg.mode = 'github'
    }
  }
  if (cfg.locale) {
    setLocale(cfg.locale)
  }
  switch (cmd) {
    case 'check':
      return await runCheck(cfg)

    case 'test':
      return await runTest(cfg)
  }

  console.log(`Usage: npx ${pkg.name} <init|check|test> [path to maatools.config.mts]`)

  return false
}
