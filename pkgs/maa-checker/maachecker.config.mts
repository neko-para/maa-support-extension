import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import type { FullConfig, TestCases } from '@nekosu/maa-checker'

const interfacePath = path.join(import.meta.dirname, '../../../MaaEnd/assets/interface.json')

const loadCase = async (file: string) => {
  const dir = path.dirname(file)
  const testCases = JSON.parse(await fs.readFile(file, 'utf8')) as TestCases
  testCases.configs.imageRoot = path.resolve(process.cwd(), dir, testCases.configs.imageRoot)
  return testCases
}

const config: FullConfig = {
  check: {
    interfacePath
  },
  test: {
    interfacePath,
    cases: [
      await loadCase(
        '../../../MaaEndTesting/tests/ADB/Official_CN/自动转交送货任务/test_depot.json'
      )
    ],

    maaVersion: '5.7.2'
  }
}

export default config
