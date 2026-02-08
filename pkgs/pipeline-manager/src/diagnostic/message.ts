import { t } from '@mse/locale'

import { type AbsolutePath, relativePath } from '../utils/types'
import type { Diagnostic } from './types'

type Position = [line: number, column: number]

export async function buildDiagnosticMessage(
  root: AbsolutePath,
  diag: Diagnostic,
  evalPos: (file: AbsolutePath, offset: number) => Promise<Position>
): Promise<[start: Position, end: Position, brief: string]> {
  const buildPos = async (loc: { file: AbsolutePath; offset: number }) => {
    const [line, column] = await evalPos(loc.file, loc.offset)
    return `${relativePath(root, loc.file)}:${line}:${column}`
  }

  const start = await evalPos(diag.file, diag.offset)
  const end = await evalPos(diag.file, diag.offset + diag.length)

  const buildBrief = async () => {
    switch (diag.type) {
      case 'conflict-task':
        return t('maa.pipeline.error.conflict-task', diag.task, await buildPos(diag.previous))
      case 'duplicate-next':
        return t('maa.pipeline.error.duplicate-next', diag.task)
      case 'unknown-task':
        return t('maa.pipeline.error.unknown-task', diag.task)
      case 'dynamic-image':
        return t('maa.pipeline.warning.image-path-dynamic')
      case 'image-path-back-slash':
        return t('maa.pipeline.warning.image-path-backslash')
      case 'image-path-dot-slash':
        return t('maa.pipeline.warning.image-path-dot-slash')
      case 'image-path-missing-png':
        return t('maa.pipeline.warning.image-path-missing-png')
      case 'unknown-image':
        return t('maa.pipeline.error.unknown-image', diag.image)
      case 'unknown-anchor':
        return t('maa.pipeline.error.unknown-anchor', diag.anchor)
      case 'unknown-attr':
        return t('maa.pipeline.error.unknown-attr', diag.attr)
      case 'unknown-locale':
        return t('maa.pipeline.error.unknown-locale', diag.locale)
      case 'missing-locale':
        return t('maa.pipeline.error.missing-locale', diag.locale, diag.langs.join(', '))
      case 'mpe-config':
        return t('maa.pipeline.warning.mpe-config')
      case 'int-conflict-controller':
        return t('maa.pipeline.error.conflict-controller', diag.ctrl, await buildPos(diag.previous))
      case 'int-unknown-controller':
        return t('maa.pipeline.error.unknown-controller', diag.ctrl)
      case 'int-conflict-resource':
        return t('maa.pipeline.error.conflict-resource', diag.res, await buildPos(diag.previous))
      case 'int-unknown-resource':
        return t('maa.pipeline.error.unknown-resource', diag.res)
      case 'int-conflict-option':
        return t('maa.pipeline.error.conflict-option', diag.option, await buildPos(diag.previous))
      case 'int-unknown-option':
        return t('maa.pipeline.error.unknown-option', diag.option)
      case 'int-conflict-case':
        return t(
          'maa.pipeline.error.conflict-case',
          diag.case,
          diag.option,
          await buildPos(diag.previous)
        )
      case 'int-unknown-case':
        return t('maa.pipeline.error.unknown-case', diag.case, diag.option)
      case 'int-switch-name-invalid':
        return t('maa.pipeline.error.switch-name-invalid')
      case 'int-switch-missing':
        if (diag.missingYes && diag.missingNo) {
          return t('maa.pipeline.error.switch-missing-all')
        } else if (diag.missingYes) {
          return t('maa.pipeline.error.switch-missing-yes')
        } else {
          return t('maa.pipeline.error.switch-missing-no')
        }
      case 'int-switch-should-fixed':
        return t('maa.pipeline.warning.switch-name-should-fixed')
      case 'int-unknown-entry-task':
        return t('maa.pipeline.error.unknown-entry-task', diag.task)
      case 'int-override-unknown-task':
        return t('maa.pipeline.error.override-unknown-task', diag.task)
    }
    return `unknown diagnostic: ${JSON.stringify(diag)}`
  }

  return [start, end, await buildBrief()]
}
