import type { AbsolutePath } from '@mse/pipeline-manager'

export type RecoJob = {
  nodes: string[]
  imagePath: string
  imagePathRaw: string
}

export type RecoJobGroup = {
  name: string
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
  group: RecoJobGroup
  result: RecoResult[]
}
