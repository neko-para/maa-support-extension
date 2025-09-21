export default class SimpleParser {
  constructor(lexRule: { token: [key: string, rule: RegExp][]; ignore: RegExp })

  rule: RuleContext

  parse(text: string): unknown
}

export type ReduceFunc = (elems: unknown[]) => unknown
export type LoopReduceFunc = (elem: unknown, elems: unknown[]) => unknown

export type RuleContext = {
  entry: (...keys: string[]) => WhenContext
  for: (expr?: string) => ForContext
}

export type ForContext = {
  for: (expr?: string) => ForContext
  with: (func: (ctx: ForContext) => void) => ForContext
  when: (...keys: string[]) => WhenContext
  sameas: (key: string) => ForContext
}

export type WhenContext = {
  do: (func?: ReduceFunc) => ForContext
  withloop: () => WithLoopContext
}

export type WithLoopContext = {
  when: (...keys: string[]) => {
    do: (func?: ReduceFunc) => WithLoopContext
  }
  do: (func?: LoopReduceFunc) => ForContext
}
