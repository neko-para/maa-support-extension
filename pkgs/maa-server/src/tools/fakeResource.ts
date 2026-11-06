import * as fs from 'fs/promises'
import * as path from 'node:path'
import * as os from 'os'

import { logger } from '../server'

/**
 * 一次性识别工具共用的 fake resource：目录里只有一个空 pipeline 文件，
 * 让 pipeline_override 能临时定义识别/动作节点。
 */
export async function setupFakeResource() {
  const temp = path.join(os.tmpdir(), 'maavsc-matches')
  logger.info(`create fake resource under ${temp}`)

  await fs.mkdir(path.join(temp, 'pipeline'), { recursive: true })
  await fs.writeFile(path.join(temp, 'pipeline', '1.json'), '{}')

  return temp
}
