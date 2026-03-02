import type { AbsolutePath } from '@nekosu/maa-pipeline-manager'

import type { TestCases } from '../types/config'

export type RecoJob = {
  nodes: string[]
  imagePath: string
  imagePathRaw: string
}

export type RecoJobGroup = {
  name: string
  test?: AbsolutePath
  controller: string
  resource: string
  imagesRaw: string[]
  images: AbsolutePath[]
  nodes: string[]
}

export type RecoResult = {
  imagePath: string
  imagePathRaw: string
  node: string
  hit: boolean
  detail: maa.RecoDetail | null
}

export type GroupRecoResult = {
  cases: TestCases
  result: RecoResult[]
}

export type RecoTestConfig = TestCases
