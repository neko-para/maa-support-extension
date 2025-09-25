import type { MaaTaskExpr } from '../types'
import { buildExprImpl } from './build'
import { getParser } from './parser'
import type { MaaTaskExprAst } from './types'

export type { MaaTaskExpr, MaaTaskExprAst }

export function parseExpr(expr: MaaTaskExpr): MaaTaskExprAst {
  try {
    return getParser().parse(expr)
  } catch (err) {
    throw `parse expr failed ${expr} error ${err}`
  }
}

export function buildExpr(ast: MaaTaskExprAst): MaaTaskExpr {
  return buildExprImpl(ast) as MaaTaskExpr
}
