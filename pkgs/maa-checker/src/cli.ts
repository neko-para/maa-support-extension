import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'

import { setLocale } from '@nekosu/maa-locale'

import { runCheck } from './check'
import { runTest } from './test'
import type { FullConfig } from './types/config'
import { loadConfig } from './utils/config'

const defaultConfig = `import type { FullConfig } from '@nekosu/maa-checker'

const config: FullConfig = {
  check: {
    interfacePath: 'assets/interface.json'
  }
}

export default config
`

export async function runCli(cmd: 'init' | 'check' | 'test', cfg: string | FullConfig) {
  if (typeof cfg === 'string') {
    const resolvedCfg = await loadConfig(cfg)
    if (!resolvedCfg) {
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
    case 'init':
      if (existsSync('maachecker.config.mts')) {
        await fs.writeFile('maachecker.config.mts', defaultConfig)
      }
      return true

    case 'check':
      return await runCheck(cfg)

    case 'test':
      return await runTest(cfg)
  }
  return false
}
