import { readFileSync } from 'fs'
import * as fs from 'fs/promises'

import type { ProgramOption } from '../option'
import { gzDecompress } from '../utils'
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

export async function performRecoTest(option: ProgramOption) {
  const { promise, resolve } = Promise.withResolvers<void>()

  const chunks: Buffer[] = []
  process.stdin.on('data', (data: Buffer) => {
    chunks.push(data)
  })
  process.stdin.on('end', () => {
    resolve()
  })
  await promise

  const resultJson = gzDecompress(Buffer.concat(chunks).toString())
  const result: GroupRecoResult[] = JSON.parse(resultJson)

  for (const group of result) {
    if (!group.group.test) {
      continue
    }
    const cfg = JSON.parse(await fs.readFile(group.group.test, 'utf8')) as RecoTestConfig

    for (const info of cfg.cases) {
      const img = info.image + '.png'
      console.log(`${img}:`)
      let passedCount = 0
      for (const node of group.group.nodes) {
        const res = group.result.find(res => res.imagePathRaw === img && res.node === node)
        if (!res) {
          console.log(`  Cannot find result node ${node}`)
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
            console.log(`  Node ${node} should hit but missed`)
            continue
          }
          if (typeof caseInfo !== 'string') {
            if (!res.detail) {
              console.log(`  Detail for node ${node} missing`)
              continue
            }
            if (!checkRect(caseInfo.box, res.detail.box)) {
              console.log(
                `  Node ${node} hit but out of box. Expect ${JSON.stringify(caseInfo.box)}, hit ${JSON.stringify(res.detail.box)}`
              )
              continue
            }
          }
        } else {
          if (res.hit) {
            console.log(`  Node ${node} should miss but hit`)
            continue
          }
        }
        passedCount += 1
      }
      if (passedCount === group.group.nodes.length) {
        console.log('  Pass')
      } else {
        console.log('  Fail')
      }
    }
  }
}
