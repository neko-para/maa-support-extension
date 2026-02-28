import { runCheck } from './check'
import { runTest } from './test'
import type { FullConfig } from './types/config'
import { loadConfig } from './utils/config'

export async function runCli(cmd: 'check' | 'test', cfg: string | FullConfig) {
  if (typeof cfg === 'string') {
    cfg = await loadConfig(cfg)
  }
  if (process.env['GITHUB_ACTIONS']) {
    if (!cfg.mode) {
      cfg.mode = 'github'
    }
  }
  switch (cmd) {
    case 'check':
      return await runCheck(cfg)
    case 'test':
      return await runTest(cfg)
  }
  return false
}
