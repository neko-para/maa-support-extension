import type { AbsolutePath } from '@mse/pipeline-manager'

export type RecoJob = {
  nodes: string[]
  imagePath: string
  imagePathRaw: string
}

export type RecoJobGroup = {
  name: string
  test?: AbsolutePath
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

export type RecoTestConfig = {
  configs: {
    controller: string
    resource: string
  }
  cases: {
    name: string
    image: string
    hits: (
      | string
      | {
          node: string
          box: maa.Rect
        }
    )[]
  }[]
}
