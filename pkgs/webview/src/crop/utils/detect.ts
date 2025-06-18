import type { Box, Pos } from './2d'

export type CornerType = 'lt' | 'lb' | 'rt' | 'rb'
const corners: CornerType[] = ['lt', 'lb', 'rt', 'rb']

export type EdgeType = 'l' | 't' | 'r' | 'b'
const edges: EdgeType[] = ['l', 't', 'r', 'b']

export const resizeCursor: Record<CornerType | EdgeType | 'def', string> = {
  lt: 'nwse-resize',
  rb: 'nwse-resize',
  lb: 'nesw-resize',
  rt: 'nesw-resize',
  l: 'ew-resize',
  r: 'ew-resize',
  t: 'ns-resize',
  b: 'ns-resize',
  def: 'default'
}
export const edgeSide: Record<EdgeType, 'x' | 'y'> = {
  l: 'x',
  r: 'x',
  t: 'y',
  b: 'y'
}

export function detectCorner(box: Box, pos: Pos, thres = 4): CornerType | null {
  for (const corner of corners) {
    if (pos.dis(box[corner]) <= thres) {
      return corner
    }
  }
  return null
}

export function detectEdge(box: Box, pos: Pos, thres = 4): EdgeType | null {
  for (const edge of edges) {
    if (Math.abs(pos[edgeSide[edge]] - box[edge]) < thres) {
      return edge
    }
  }
  return null
}
