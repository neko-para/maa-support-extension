export type * as Maa from '@maaxyz/maa-node'

export let maa: typeof import('@maaxyz/maa-node')

export function setMaa(obj: typeof import('@maaxyz/maa-node')) {
  maa = obj
}
