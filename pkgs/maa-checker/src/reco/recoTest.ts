import { readFileSync } from 'fs'
import * as fs from 'fs/promises'

import type { ProgramOption } from '../option'
import { getColorInfo, gzDecompress } from '../utils'
import type { GroupRecoResult, RecoTestConfig } from './types'

// return if real inside expect
function checkRect(expect: maa.Rect, real: maa.Rect) {
  return (
    real[0] >= expect[0] &&
    real[1] >= expect[1] &&
    real[0] + real[2] <= expect[0] + expect[2] &&
    real[1] + real[3] <= expect[1] + expect[3]
  )
}

async function readInput() {
  const { promise, resolve } = Promise.withResolvers<string>()

  const chunks: Buffer[] = []
  process.stdin.on('data', (data: Buffer) => {
    chunks.push(data)
  })
  process.stdin.on('end', () => {
    resolve(gzDecompress(Buffer.concat(chunks).toString()))
  })
  return JSON.parse(await promise) as GroupRecoResult[]
}

export async function performRecoTest(option: ProgramOption) {
  return performRecoTestImpl(option, await readInput())
}

export async function performRecoTestImpl(option: ProgramOption, result: GroupRecoResult[]) {
  const { enableColor, hitPrefix, missPrefix, resetSuffix } = getColorInfo(option)

  for (const group of result) {
    if (!group.group.test) {
      continue
    }
    const cfg = JSON.parse(await fs.readFile(group.group.test, 'utf8')) as RecoTestConfig

    for (const info of cfg.cases) {
      const img = info.image + '.png'
      const errors: string[] = []
      for (const node of group.group.nodes) {
        const res = group.result.find(res => res.imagePathRaw === img && res.node === node)
        if (!res) {
          errors.push(`  Cannot find result node ${node}`)
          continue
        }
        const caseInfo = info.hits.find(hit => {
          if (typeof hit === 'string') {
            return hit === node
          } else {
            return hit.node === node
          }
        })
        if (caseInfo) {
          if (!res.hit) {
            errors.push(`  Node ${node} should hit but missed`)
            continue
          }
          if (typeof caseInfo !== 'string') {
            if (!res.detail) {
              errors.push(`  Detail for node ${node} missing`)
              continue
            }
            if (!checkRect(caseInfo.box, res.detail.box)) {
              errors.push(
                `  Node ${node} hit but out of box. Expect ${JSON.stringify(caseInfo.box)}, hit ${JSON.stringify(res.detail.box)}`
              )
              continue
            }
          }
        } else {
          if (res.hit) {
            errors.push(`  Node ${node} should miss but hit`)
            continue
          }
        }
      }
      if (errors.length > 0) {
        console.log(`${missPrefix}Fail ${img}${resetSuffix}`)
        for (const err of errors) {
          console.log(`  ${err}`)
        }
      } else {
        console.log(`${hitPrefix}Pass ${img}${resetSuffix}`)
      }
    }
  }
}
