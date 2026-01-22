import SimpleParser, { type TokenFilter } from './impl'

export type Range = [offset: number, length: number]

type TokenDecl = [token: string, grammar: RegExp]

type TokenArray<Decls extends TokenDecl[], Results extends string[] = []> = Decls extends [
  infer First extends TokenDecl,
  ...infer Rest extends TokenDecl[]
]
  ? TokenArray<Rest, [...Results, First[0]]>
  : Results

type BuildToken<Tokens extends string[], Result extends string = never> = Tokens extends [
  infer First extends string,
  ...infer Rest extends string[]
]
  ? BuildToken<Rest, Result | `%${First}`>
  : Result

type GetType<
  Tokens extends string,
  Exprs extends Record<string, unknown>,
  Expr extends Tokens | keyof Exprs
> = Expr extends Tokens
  ? { value: string; range: Range }
  : Expr extends keyof Exprs
    ? Exprs[Expr]
    : never

type ConvertArguments<
  Tokens extends string,
  Exprs extends Record<string, unknown>,
  WhenExprs extends (Tokens | keyof Exprs)[],
  Results extends unknown[] = []
> = WhenExprs extends [
  infer Token extends Tokens | keyof Exprs,
  ...infer Rest extends (Tokens | keyof Exprs)[]
]
  ? ConvertArguments<Tokens, Exprs, Rest, [...Results, GetType<Tokens, Exprs, Token>]>
  : Results

type Select<Enable extends boolean, On, Off> = Enable extends true ? On : Off
type EnableIf<Enable extends boolean, Type> = Select<Enable, Type, never>

///

type TypedParser<Entry, Tokens extends string, Exprs extends Record<string, unknown>> = {
  rule: RuleContext<Entry, Tokens, Exprs>
  parse(input: string): Entry
}

type RuleContext<Entry, Tokens extends string, Exprs extends Record<string, unknown>> = {
  entry: Select<
    ((v: never) => void) extends (v: Entry) => void ? true : false,
    <Expr extends keyof Exprs>(expr: Expr) => WhenContext<Entry, Tokens, Exprs, Expr, [Expr], true>,
    never
  >
  for<Expr extends keyof Exprs>(expr: Expr): ForContext<Entry, Tokens, Exprs, Expr>
}

type ForContext<
  Entry,
  Tokens extends string,
  Exprs extends Record<string, unknown>,
  Expr extends keyof Exprs
> = {
  for<NextExpr extends keyof Exprs>(expr: NextExpr): ForContext<Entry, Tokens, Exprs, NextExpr>
  when<WhenExprs extends (Tokens | keyof Exprs)[]>(
    ...exprs: [...WhenExprs]
  ): WhenContext<Entry, Tokens, Exprs, Expr, WhenExprs>
  sameas<SameExpr extends Tokens | keyof Exprs>(
    expr: SameExpr
  ): EnableIf<
    GetType<Tokens, Exprs, SameExpr> extends GetType<Tokens, Exprs, Expr> ? true : false,
    ForContext<Entry, Tokens, Exprs, Expr>
  >
}

type WhenContext<
  Entry,
  Tokens extends string,
  Exprs extends Record<string, unknown>,
  Expr extends keyof Exprs,
  WhenExprs extends (Tokens | keyof Exprs)[],
  __IsEntry extends boolean = false
> = {
  do: Select<
    GetType<Tokens, Exprs, WhenExprs[0]> extends Exprs[Expr] ? true : false,
    (
      func?: (elems: ConvertArguments<Tokens, Exprs, WhenExprs>) => Exprs[Expr]
    ) => ForContext<Select<__IsEntry, Exprs[Expr], Entry>, Tokens, Exprs, Expr>,
    (
      func: (elems: ConvertArguments<Tokens, Exprs, WhenExprs>) => Exprs[Expr]
    ) => ForContext<Select<__IsEntry, Exprs[Expr], Entry>, Tokens, Exprs, Expr>
  >
  withloop(): WithLoopContext<Entry, Tokens, Exprs, Expr, WhenExprs, never>
}

type WithLoopContext<
  Entry,
  Tokens extends string,
  Exprs extends Record<string, unknown>,
  Expr extends keyof Exprs,
  WhenExprs extends (Tokens | keyof Exprs)[],
  LoopType
> = {
  when<LoopWhenExprs extends (Tokens | keyof Exprs)[]>(
    ...exprs: [...LoopWhenExprs]
  ): WithLoopWhenContext<Entry, Tokens, Exprs, Expr, WhenExprs, LoopType, LoopWhenExprs>
  do(
    func: (elems: [...ConvertArguments<Tokens, Exprs, WhenExprs>, LoopType[]]) => Exprs[Expr]
  ): RuleContext<Entry, Tokens, Exprs>
}

type WithLoopWhenContext<
  Entry,
  Tokens extends string,
  Exprs extends Record<string, unknown>,
  Expr extends keyof Exprs,
  WhenExprs extends (Tokens | keyof Exprs)[],
  LoopType,
  LoopWhenExprs extends (Tokens | keyof Exprs)[]
> = {
  do(): WithLoopContext<
    Entry,
    Tokens,
    Exprs,
    Expr,
    WhenExprs,
    LoopType | GetType<Tokens, Exprs, LoopWhenExprs[0]>
  >
  do<Ret>(
    func: (elems: ConvertArguments<Tokens, Exprs, LoopWhenExprs>) => Ret
  ): WithLoopContext<Entry, Tokens, Exprs, Expr, WhenExprs, LoopType | Ret>
}

type ExtractResultType<Return> =
  Return extends ForContext<infer Entry, infer Tokens, infer Exprs, infer Expr>
    ? Entry
    : Return extends RuleContext<infer Entry, infer Tokens, infer Exprs>
      ? Entry
      : never

///

export function declExpr<Exprs extends Record<string, unknown>>(): Exprs {
  return {} as Exprs
}

export function makeParser<
  Exprs extends Record<string, unknown>,
  TokenDecls extends TokenDecl[],
  RuleResult
>(
  token: [...TokenDecls],
  tokenFilter: (
    curr: BuildToken<TokenArray<TokenDecls>>,
    getBack: (idx: number) => BuildToken<TokenArray<TokenDecls>> | null
  ) => boolean,
  expr: Exprs,
  ignore: RegExp,
  setup: (rule: RuleContext<never, BuildToken<TokenArray<TokenDecls>>, Exprs>) => RuleResult
) {
  const parserImpl = new SimpleParser({
    token,
    ignore,
    tokenFilter: tokenFilter as TokenFilter
  }) as any as TypedParser<never, BuildToken<TokenArray<TokenDecls>>, Exprs>
  setup(parserImpl.rule)
  return parserImpl as any as TypedParser<
    ExtractResultType<RuleResult>,
    BuildToken<TokenArray<TokenDecls>>,
    Exprs
  >
}
