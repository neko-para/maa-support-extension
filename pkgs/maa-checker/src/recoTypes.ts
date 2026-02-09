export type RecoJob = {
  nodes: string[]
  image: string
  imageIndex: number
  imagePath: string
}

export type RecoResult = {
  image: number
  imagePath: string
  node: string
  hit: boolean
  detail: maa.RecoDetail | null
}
