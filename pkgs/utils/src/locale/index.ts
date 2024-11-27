import * as vscode from 'vscode'

import localeEn from './locale.en'
import localeZhCn from './locale.zh-cn'

type LocaleIndex = keyof typeof localeEn

type CountBrace<
  Str extends string,
  Cnt extends string[] = []
> = Str extends `${infer L}\{${Cnt['length']}\}${infer R}` ? CountBrace<Str, [...Cnt, string]> : Cnt

const locale: Record<LocaleIndex, string> = vscode.env.language.startsWith('zh')
  ? localeZhCn
  : localeEn

export function t<K extends LocaleIndex>(key: K, ...args: CountBrace<(typeof localeEn)[K]>) {
  let str = locale[key]
  for (const [idx, arg] of Object.entries(args)) {
    str = str.replaceAll(`\{${idx}\}`, arg)
  }
  return str
}
