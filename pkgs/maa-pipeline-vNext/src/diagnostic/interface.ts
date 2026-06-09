import { Snapshot } from '../snapshot/snapshot'
import { isString } from '../utils/parse'
import type { Diagnostic } from './types'
import { diagPos } from './utils'

export function checkInterface(snapshot: Parameters<typeof Snapshot.allDecls>[0]): Diagnostic[] {
  const result: Diagnostic[] = []

  // 惰性合并——各 interface 文件保持独立存储，查询时拼接
  const decls = Snapshot.allInterfaceDecls(snapshot)
  const refs = Snapshot.allInterfaceRefs(snapshot)
  if (decls.length === 0 && refs.length === 0) {
    return result
  }

  const interfaceFile = snapshot.interfaceFile

  // duplicate detection helpers — each item carries its own .file
  function findDuplicates<
    T extends { name: string; file: string; location: { offset: number; length: number } }
  >(items: readonly T[], typeName: string) {
    const seen = new Map<string, T>()
    for (const item of items) {
      const prev = seen.get(item.name)
      if (prev) {
        const diagBase = {
          type: typeName,
          level: 'error' as const,
          ...diagPos(item.location, item.file),
          previous: diagPos(prev.location, prev.file)
        }
        if (typeName === 'int-conflict-controller') {
          result.push({ ...diagBase, ctrl: item.name } as Diagnostic)
        } else if (typeName === 'int-conflict-resource') {
          result.push({ ...diagBase, res: item.name } as Diagnostic)
        } else if (typeName === 'int-conflict-group') {
          result.push({ ...diagBase, group: item.name } as Diagnostic)
        } else if (typeName === 'int-conflict-option') {
          result.push({ ...diagBase, option: item.name } as Diagnostic)
        } else if (typeName === 'int-conflict-case') {
          const caseItem = item as unknown as { name: string; option: string }
          result.push({ ...diagBase, option: caseItem.option, case: item.name } as Diagnostic)
        }
      } else {
        seen.set(item.name, item)
      }
    }
  }

  // conflict-controller
  findDuplicates(
    decls.filter(d => d.type === 'interface.controller'),
    'int-conflict-controller'
  )
  // conflict-resource
  findDuplicates(
    decls.filter(d => d.type === 'interface.resource'),
    'int-conflict-resource'
  )
  // conflict-group
  findDuplicates(
    decls.filter(d => d.type === 'interface.group'),
    'int-conflict-group'
  )
  // conflict-option
  findDuplicates(
    decls.filter(d => d.type === 'interface.option'),
    'int-conflict-option'
  )

  // Option cases and switch validation
  const optDecls = decls.filter(d => d.type === 'interface.option')
  for (const opt of optDecls) {
    if (!opt.optionType || opt.optionType === 'select' || opt.optionType === 'switch') {
      const cases = decls.filter(d => d.type === 'interface.case' && d.option === opt.name)
      findDuplicates(cases, 'int-conflict-case')

      const caseRefs = refs.filter(r => r.type === 'interface.case' && r.option === opt.name)
      const caseNames = new Set(cases.map(c => c.name))
      for (const cr of caseRefs) {
        if (!caseNames.has(cr.target)) {
          result.push({
            level: 'error',
            ...diagPos(cr.location, cr.file),
            type: 'int-unknown-case',
            option: opt.name,
            case: cr.target
          })
        }
      }

      if (opt.optionType === 'switch') {
        let missingYes = true
        let missingNo = true
        for (const c of cases) {
          if (c.name === 'Yes') {
            missingYes = false
          } else if (c.name === 'No') {
            missingNo = false
          } else if (c.name.toLowerCase() === 'yes') {
            missingYes = false
            result.push({
              level: 'warning',
              ...diagPos(c.location, c.file),
              type: 'int-switch-should-fixed'
            })
          } else if (c.name.toLowerCase() === 'no') {
            missingNo = false
            result.push({
              level: 'warning',
              ...diagPos(c.location, c.file),
              type: 'int-switch-should-fixed'
            })
          } else {
            result.push({
              level: 'error',
              ...diagPos(c.location, c.file),
              type: 'int-switch-name-invalid'
            })
          }
        }
        if (missingYes || missingNo) {
          result.push({
            level: 'error',
            ...diagPos(opt.location, opt.file),
            type: 'int-switch-missing',
            option: opt.name,
            missingYes,
            missingNo
          })
        }
      }
    }
  }

  // Unknown refs
  const ctrlNames = new Set(decls.filter(d => d.type === 'interface.controller').map(d => d.name))
  const resNames = new Set(decls.filter(d => d.type === 'interface.resource').map(d => d.name))
  const groupNames = new Set(decls.filter(d => d.type === 'interface.group').map(d => d.name))
  const optNames = new Set(optDecls.map(d => d.name))

  for (const ref of refs) {
    const loc = diagPos(ref.location, ref.file)
    if (ref.type === 'interface.controller' && !ctrlNames.has(ref.target)) {
      result.push({ level: 'error', ...loc, type: 'int-unknown-controller', ctrl: ref.target })
    }
    if (ref.type === 'interface.resource' && !resNames.has(ref.target)) {
      result.push({ level: 'error', ...loc, type: 'int-unknown-resource', res: ref.target })
    }
    if (ref.type === 'interface.group' && !groupNames.has(ref.target)) {
      result.push({ level: 'error', ...loc, type: 'int-unknown-group', group: ref.target })
    }
    if (ref.type === 'interface.option' && !optNames.has(ref.target)) {
      result.push({ level: 'error', ...loc, type: 'int-unknown-option', option: ref.target })
      if (ref.presetValue) {
        const optDecl = optDecls.find(d => d.name === ref.target)
        if (optDecl) {
          const ot = optDecl.optionType ?? 'select'
          // presetValue 是 raw value（来自 jsonc-parser Node），使用 interfaceFile 作为 fallback
          if (ot === 'select' || ot === 'switch') {
            if (!isString(ref.presetValue as never)) {
              result.push({
                level: 'error',
                ...diagPos(ref.presetValue as never, interfaceFile),
                type: 'int-preset-type-error',
                option: ref.target,
                expected: 'string'
              })
            }
          } else if (ot === 'checkbox') {
            if (!Array.isArray(ref.presetValue)) {
              result.push({
                level: 'error',
                ...diagPos(ref.presetValue as never, interfaceFile),
                type: 'int-preset-type-error',
                option: ref.target,
                expected: 'array'
              })
            }
          } else if (ot === 'input') {
            if (
              typeof ref.presetValue !== 'object' ||
              ref.presetValue === null ||
              Array.isArray(ref.presetValue)
            ) {
              result.push({
                level: 'error',
                ...diagPos(ref.presetValue as never, interfaceFile),
                type: 'int-preset-type-error',
                option: ref.target,
                expected: 'object'
              })
            }
          }
        }
      }
    }
  }

  // int-unknown-entry-task, int-override-unknown-task
  const taskList = new Set(Snapshot.listTasks(snapshot))
  for (const ref of refs) {
    if (ref.type === 'interface.task_entry') {
      if (!taskList.has(ref.target as never)) {
        result.push({
          level: 'error',
          ...diagPos(ref.location, ref.file),
          type: 'int-unknown-entry-task',
          task: ref.target
        })
      }
    }
  }

  return result
}
