import { t } from '@nekosu/maa-locale'

import type { ParsedInterface } from '../interface/types'
import type { InterfaceConfig, ResourceRuntime } from './types'

/**
 * 构建 ResourceRuntime——纯数据转换，无 maa 依赖。
 */
export function buildResourceRuntime(
  data: ParsedInterface,
  config: InterfaceConfig
): ResourceRuntime | string {
  const resInfo = data.resource[config.resource ?? '']
  if (!resInfo) {
    return t('maa.pi.error.cannot-find-resource', config.resource ?? '')
  }

  const paths = (typeof resInfo.path === 'string' ? [resInfo.path] : resInfo.path).map(x =>
    (x as string).replaceAll('{PROJECT_DIR}', '.')
  )

  return {
    name: config.resource ?? '',
    paths,
    option: resInfo.option
  }
}
