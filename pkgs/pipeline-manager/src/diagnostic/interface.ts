import type { InterfaceBundle } from '../interface/interface'
import type { Diagnostic } from './types'

export function checkInterface<T>(bundle: InterfaceBundle<T>): Diagnostic[] {
  const result: Diagnostic[] = []

  const layer = bundle.topLayer
  if (layer.type === 'interface') {
    const realTasks = new Set(layer.parent?.getTaskListNotUnique() ?? [])

    for (const ref of layer.mergedRefs) {
      if (ref.type === 'task.entry') {
        if (!realTasks.has(ref.target)) {
          result.push({
            level: 'error',
            file: ref.file,
            offset: ref.location.offset,
            length: ref.location.length,
            type: 'int-unknown-entry-task',
            task: ref.target
          })
        }
      }
    }

    for (const decl of layer.mergedDecls) {
      if (decl.type === 'task.decl') {
        if (!realTasks.has(decl.task)) {
          result.push({
            level: 'error',
            file: decl.file,
            offset: decl.location.offset,
            length: decl.location.length,
            type: 'int-override-unknown-task',
            task: decl.task
          })
        }
      }
    }
  }

  const ctrlDecls = bundle.info.decls.filter(decl => decl.type === 'interface.controller')
  const ctrls = new Map<string, (typeof ctrlDecls)[number]>()
  for (const decl of ctrlDecls) {
    if (ctrls.has(decl.name)) {
      const prev = ctrls.get(decl.name)!
      result.push({
        level: 'error',
        file: decl.file,
        offset: decl.location.offset,
        length: decl.location.length,
        type: 'int-conflict-controller',
        ctrl: decl.name,
        previous: {
          file: prev.file,
          offset: prev.location.offset,
          length: prev.location.length
        }
      })
    } else {
      ctrls.set(decl.name, decl)
    }
  }

  const resDecls = bundle.info.decls.filter(decl => decl.type === 'interface.resource')
  const ress = new Map<string, (typeof resDecls)[number]>()
  for (const decl of resDecls) {
    if (ress.has(decl.name)) {
      const prev = ress.get(decl.name)!
      result.push({
        level: 'error',
        file: decl.file,
        offset: decl.location.offset,
        length: decl.location.length,
        type: 'int-conflict-resource',
        res: decl.name,
        previous: {
          file: prev.file,
          offset: prev.location.offset,
          length: prev.location.length
        }
      })
    } else {
      ress.set(decl.name, decl)
    }
  }

  const optDecls = bundle.info.decls.filter(decl => decl.type === 'interface.option')
  const options = new Map<string, (typeof optDecls)[number]>()
  for (const decl of optDecls) {
    if (options.has(decl.name)) {
      const prev = options.get(decl.name)!
      result.push({
        level: 'error',
        file: decl.file,
        offset: decl.location.offset,
        length: decl.location.length,
        type: 'int-conflict-option',
        option: decl.name,
        previous: {
          file: prev.file,
          offset: prev.location.offset,
          length: prev.location.length
        }
      })
    } else {
      options.set(decl.name, decl)

      if (!decl.optionType || decl.optionType === 'select' || decl.optionType === 'switch') {
        const caseDecls = bundle.info.decls.filter(
          decl2 => decl2.type === 'interface.case' && decl2.option === decl.name
        )
        const cases = new Map<string, (typeof caseDecls)[number]>()
        for (const decl2 of caseDecls) {
          if (cases.has(decl2.name)) {
            const prev = cases.get(decl2.name)!
            result.push({
              level: 'error',
              file: decl2.file,
              offset: decl2.location.offset,
              length: decl2.location.length,
              type: 'int-conflict-case',
              option: decl.name,
              case: decl2.name,
              previous: {
                file: prev.file,
                offset: prev.location.offset,
                length: prev.location.length
              }
            })
          } else {
            cases.set(decl2.name, decl2)
          }
        }

        const caseRefs = bundle.info.refs
          .filter(ref => ref.type === 'interface.case')
          .filter(ref => ref.option === decl.name)
        for (const ref of caseRefs) {
          if (!cases.has(ref.target)) {
            result.push({
              level: 'error',
              file: ref.file,
              offset: ref.location.offset,
              length: ref.location.length,
              type: 'int-unknown-case',
              option: decl.name,
              case: ref.target
            })
          }
        }

        if (decl.optionType === 'switch') {
          let missingYes = true
          let missingNo = true
          for (const [name, decl2] of cases) {
            if (name === 'Yes') {
              missingYes = false
            } else if (name === 'No') {
              missingNo = false
            } else if (name.toLowerCase() === 'yes') {
              missingYes = false
              result.push({
                level: 'warning',
                file: decl2.file,
                offset: decl2.location.offset,
                length: decl2.location.length,
                type: 'int-switch-should-fixed'
              })
            } else if (name.toLowerCase() === 'no') {
              missingNo = false
              result.push({
                level: 'warning',
                file: decl2.file,
                offset: decl2.location.offset,
                length: decl2.location.length,
                type: 'int-switch-should-fixed'
              })
            } else {
              result.push({
                level: 'error',
                file: decl2.file,
                offset: decl2.location.offset,
                length: decl2.location.length,
                type: 'int-switch-name-invalid'
              })
            }
          }
          if (missingYes || missingNo) {
            result.push({
              level: 'error',
              file: decl.file,
              offset: decl.location.offset,
              length: decl.location.length,
              type: 'int-switch-missing',
              option: decl.name,
              missingYes,
              missingNo
            })
          }
        }
      }
    }
  }

  for (const ref of bundle.info.refs) {
    if (ref.type === 'interface.controller') {
      if (!ctrls.has(ref.target)) {
        result.push({
          level: 'error',
          file: ref.file,
          offset: ref.location.offset,
          length: ref.location.length,
          type: 'int-unknown-controller',
          ctrl: ref.target
        })
      }
    } else if (ref.type === 'interface.resource') {
      if (!ctrls.has(ref.target)) {
        result.push({
          level: 'error',
          file: ref.file,
          offset: ref.location.offset,
          length: ref.location.length,
          type: 'int-unknown-resource',
          res: ref.target
        })
      }
    } else if (ref.type === 'interface.option') {
      if (!options.has(ref.target)) {
        result.push({
          level: 'error',
          file: ref.file,
          offset: ref.location.offset,
          length: ref.location.length,
          type: 'int-unknown-option',
          option: ref.target
        })
      }
    }
  }

  return result
}
