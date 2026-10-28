import * as path from 'node:path'

import type { FullConfig, TestCases } from '../types/config'
import type { RecoJob } from './types'

export function createRecoJobs(
  images: readonly { image: string; imagePath: string }[],
  nodes: readonly string[],
  maxNodePerJob: number
): RecoJob[] {
  if (!Number.isInteger(maxNodePerJob) || maxNodePerJob < 1) {
    throw new RangeError('test.maxNodePerJob must be a positive integer')
  }
  const uniqueImages = new Map(images.map(image => [image.imagePath, image]))
  const jobs: RecoJob[] = []
  for (const { image, imagePath } of uniqueImages.values()) {
    for (let start = 0; start < nodes.length; start += maxNodePerJob) {
      jobs.push({
        imagePath,
        imagePathRaw: image,
        nodes: nodes.slice(start, start + maxNodePerJob)
      })
    }
  }
  return jobs
}

/** 同图的工作耗时只分配一次；最后一条取余额，避免均分后的舍入重复累积。 */
export function distributeImageDurations(
  imagePaths: readonly string[],
  durations: ReadonlyMap<string, number>
): number[] {
  const indexesByImage = new Map<string, number[]>()
  imagePaths.forEach((imagePath, index) => {
    const indexes = indexesByImage.get(imagePath) ?? []
    indexes.push(index)
    indexesByImage.set(imagePath, indexes)
  })
  const result = imagePaths.map(() => 0)
  for (const [imagePath, indexes] of indexesByImage) {
    const total = durations.get(imagePath) ?? 0
    const share = total / indexes.length
    let allocated = 0
    indexes.forEach((index, position) => {
      result[index] = position === indexes.length - 1 ? total - allocated : share
      allocated += result[index]
    })
  }
  return result
}

// return if real inside expect
export function checkRect(expect: maa.Rect, real: maa.Rect) {
  return (
    real[0] >= expect[0] &&
    real[1] >= expect[1] &&
    real[0] + real[2] <= expect[0] + expect[2] &&
    real[1] + real[3] <= expect[1] + expect[3]
  )
}

/**
 * 一条用例的截图绝对路径：`<cwd>/<casesCwd>/<imageRoot>/<image>`。
 * 判定、计划和缺图检查都用这一份拼法，别再各抄一套。
 */
export function resolveTestImagePath(
  cfg: FullConfig,
  group: Pick<TestCases, 'configs'>,
  image: string
): string {
  return path.resolve(
    cfg.cwd ?? process.cwd(),
    cfg.test?.casesCwd ?? '.',
    group.configs?.imageRoot ?? '.',
    image
  )
}
