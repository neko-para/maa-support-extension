import * as core from '@actions/core'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
  type Diagnostic,
  type DiagnosticOption,
  InterfaceBundle,
  buildDiagnosticMessage,
  performDiagnostic
} from '@mse/pipeline-manager'

import type { ProgramOption } from './option'
import { gzCompress } from './utils'

function calucateLocation(content: string, offset: number): [line: number, col: number] {
  const previous = content.slice(0, offset)
  let line = 0
  let last = 0
  for (let i = 0; i < previous.length; i++) {
    if (previous[i] === '\n') {
      line += 1
      last = i
    }
  }
  return [line + 1, offset - last]
}

export async function performCheck(option: ProgramOption, bundle: InterfaceBundle<unknown>) {
  const resourceNames = bundle.allResourceNames()
  if (resourceNames.length === 0) {
    console.log('No resource found')
    return false
  }

  const controllerNames = bundle.allControllerNames(true)

  const outputs: Diagnostic[] = []
  const diagOption: DiagnosticOption = {
    ignoreTypes: option.ignoreTypes,
    errorTypes: option.errorTypes
  }

  for (const controllerName of ['', ...controllerNames]) {
    for (const resourceName of resourceNames) {
      const groupName = controllerName ? `${controllerName}:${resourceName}` : resourceName
      if (!option.rawMode) {
        if (option.githubMode) {
          core.startGroup(groupName)
        } else {
          console.log(`Checking ${groupName}`)
        }
      }

      await bundle.switchActive(controllerName, resourceName)

      const diags = performDiagnostic(bundle, diagOption)
        .filter(diag => !option.ignoreTypes.includes(diag.type))
        .map(diag => {
          if (option.errorTypes.includes(diag.type)) {
            const newDiag = { ...diag }
            newDiag.level = 'error'
            return newDiag
          } else {
            return diag
          }
        })
      outputs.push(...diags)

      if (option.rawMode) {
        continue
      }

      const files: Record<string, string> = {}

      const locate = async (file: string, offset: number) => {
        let content = files[file]
        if (!content) {
          content = await fs.readFile(file, 'utf8')
          files[file] = content
        }
        return calucateLocation(content, offset)
      }

      for (const diag of diags) {
        const [start, end, brief] = await buildDiagnosticMessage(
          bundle.root,
          diag,
          locate,
          diagOption
        )

        const [line, col] = start
        const relative = path.relative(bundle.root, diag.file)
        if (option.githubMode) {
          core[diag.level](brief, {
            file: path.relative(option.repoFolder, diag.file),
            startLine: line,
            startColumn: col,
            endColumn: col + diag.length
          })
        } else {
          console.log(`  ${diag.level}: ${relative}:${line}:${col} ${brief}`)
        }
      }

      if (option.githubMode) {
        core.endGroup()
      }
    }
  }

  if (option.rawMode) {
    let data = JSON.stringify(outputs)
    if (option.gz) {
      data = gzCompress(data)
    }
    console.log(data)
    return true
  } else {
    const hasError = outputs.filter(diag => diag.level === 'error').length > 0
    return !hasError
  }
}
