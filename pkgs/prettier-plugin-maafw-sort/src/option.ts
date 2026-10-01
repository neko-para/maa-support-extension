import type {
  BooleanSupportOption,
  ParserOptions,
  StringArraySupportOption,
  SupportOptions
} from 'prettier'

export const options: SupportOptions = {
  maafwPipelinePatterns: {
    category: 'maafw-sort',
    type: 'string',
    array: true,
    default: [
      {
        value: ['/pipeline/.*\\.jsonc?']
      }
    ],
    description: 'MaaFramework Pipeline Json Pattern Regexs'
  } satisfies StringArraySupportOption,
  maafwInterfacePatterns: {
    category: 'maafw-sort',
    type: 'string',
    array: true,
    default: [
      {
        value: ['/interface\\.jsonc?']
      }
    ],
    description: 'MaaFramework Interface Json Pattern Regexs'
  } satisfies StringArraySupportOption,
  maafwInterfaceDetect: {
    category: 'maafw-sort',
    type: 'boolean',
    default: true,
    description: 'Detect MaaFramework Interface Json By Content When Patterns Miss'
  } satisfies BooleanSupportOption,
  maafwLocalePatterns: {
    category: 'maafw-sort',
    type: 'string',
    array: true,
    default: [
      {
        value: ['/locales/.*\\.jsonc?']
      }
    ],
    description: 'MaaFramework Localization Json Pattern Regexs'
  } satisfies StringArraySupportOption
}

function extractRegexArray(vals: unknown) {
  const res: RegExp[] = []
  if (Array.isArray(vals)) {
    for (const val of vals) {
      if (typeof val === 'string') {
        try {
          res.push(new RegExp(val))
        } catch {
          //
        }
      }
    }
  }
  return res
}

export function parseOption(opt: ParserOptions) {
  const pipelinePatterns = extractRegexArray(opt.maafwPipelinePatterns)
  const interfacePatterns = extractRegexArray(opt.maafwInterfacePatterns)
  const localePatterns = extractRegexArray(opt.maafwLocalePatterns)
  const interfaceDetect = opt.maafwInterfaceDetect !== false
  return {
    pipelinePatterns,
    interfacePatterns,
    localePatterns,
    interfaceDetect
  }
}
