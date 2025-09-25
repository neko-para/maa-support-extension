import { MaaTaskExprAst } from './types'

export function buildExprImpl(ast: MaaTaskExprAst): string {
  switch (ast.type) {
    case 'task':
      return ast.task
    case 'brace':
      return `(${buildExprImpl(ast.list)})`
    case '#':
      return `#${ast.virt}`
    case '@':
      return ast.list.map(expr => buildExprImpl(expr)).join('@') + (ast.virt ? `#${ast.virt}` : '')
    case '*':
      return `${buildExprImpl(ast.list)} * ${ast.count}`
    case '+':
      return `${buildExprImpl(ast.left)} + ${buildExprImpl(ast.right)}`
    case '^':
      return `${buildExprImpl(ast.left)} ^ ${buildExprImpl(ast.right)}`
  }
}
