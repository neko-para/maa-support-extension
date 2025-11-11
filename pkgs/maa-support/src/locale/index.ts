import localeEn from './locale.en'
import localeZhCn from './locale.zh-cn'

type LocaleIndex = keyof typeof localeEn

type CountBrace<
  Str extends string,
  Cnt extends string[] = []
> = Str extends `${infer L}\{${Cnt['length']}\}${infer R}` ? CountBrace<Str, [...Cnt, string]> : Cnt

// export const locale = vscode.env.language.startsWith('zh') ? 'zh' : 'en'
export const locale = 'zh'
const localeDict: Record<LocaleIndex, string> = locale === 'zh' ? localeZhCn : localeEn

export function t<K extends LocaleIndex>(key: K, ...args: CountBrace<(typeof localeEn)[K]>) {
  let str = localeDict[key]
  for (const [idx, arg] of Object.entries(args)) {
    str = str.replaceAll(`\{${idx}\}`, arg)
  }
  return str
}
