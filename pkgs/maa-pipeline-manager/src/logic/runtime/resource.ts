import { t } from '@nekosu/maa-locale'

import type { Interface, InterfaceConfig, ResourceRuntime } from '../types'

export function buildResourceRuntime(
  data: Interface,
  config: InterfaceConfig
): ResourceRuntime | string {
  const resInfo = data.resource?.find(info => info.name === config.resource)
  if (!resInfo) {
    return t('maa.pi.error.cannot-find-resource', config.resource ?? '')
  }

  const paths = (typeof resInfo.path === 'string' ? [resInfo.path] : resInfo.path).map(x =>
    x.replaceAll('{PROJECT_DIR}', '.')
  )

  return {
    name: resInfo.name,

    paths,
    option: resInfo.option
  }
}
