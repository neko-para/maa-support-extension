import * as fs from 'node:fs/promises'

import type { FullConfig, TestCases } from '@nekosu/maa-tools'

const loadCase = async (file: string) => {
  const testCases = JSON.parse(await fs.readFile(file, 'utf8')) as TestCases
  return testCases
}

const config: FullConfig = {
  cwd: '../../../MaaEnd',
  mode: 'github',
  check: {
    interfacePath: 'assets/interface.json'
  },
  test: {
    interfacePath: 'assets/interface.json',
    casesCwd: '../MaaEndTesting',
    cases: [
      await loadCase(
        '../../../MaaEndTesting/tests/ADB/Official_CN/自动转交送货任务/test_depot.json'
      )
    ],

    maaVersion: '5.7.2'
  }
}

export default config
