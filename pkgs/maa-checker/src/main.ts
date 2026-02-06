import * as core from '@actions/core'
import { existsSync, statSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { type LocaleType, setLocale } from '@mse/locale'
import {
  type AbsolutePath,
  type Diagnostic,
  FsContentLoader,
  FsContentWatcher,
  InterfaceBundle,
  buildDiagnosticMessage,
  performDiagnostic
} from '@mse/pipeline-manager'

import pkg from '../package.json'

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

const allTypes = [
  'conflict-task',
  'duplicate-next',
  'unknown-task',
  'dynamic-image',
  'image-path-back-slash',
  'image-path-dot-slash',
  'image-path-missing-png',
  'unknown-image',
  'unknown-anchor',
  'unknown-attr',
  'int-conflict-controller',
  'int-unknown-controller',
  'int-conflict-resource',
  'int-unknown-resource',
  'int-conflict-option',
  'int-unknown-option',
  'int-conflict-case',
  'int-unknown-case',
  'int-switch-name-invalid',
  'int-switch-missing',
  'int-switch-should-fixed',
  'int-unknown-entry-task',
  'int-override-unknown-task'
]

async function main() {
  if (process.argv.length < 3) {
    console.log(`Usage: npx ${pkg.name} <interface path> [options...]

Options:
  --raw             Output diagnostic json only
  --github=<repo>   Output github actions compatible warning & error messages, with repository folder <repo>.
  --ignore=<type>   Ignore <type>
                        Known types: ${allTypes.join(', ')}
  --locale=<lang>   Use locale <lang>
                        Known locales: zh, en
`)
    process.exit(1)
  }
  let interfacePath = path.resolve(process.argv[2])
  let rawMode = false
  let githubMode = false
  let repoFolder = process.cwd()
  const ignoreTypes: string[] = []

  setLocale('en')

  rawMode = process.argv[3] === '--raw'
  for (const opt of process.argv.slice(3)) {
    if (opt === '--raw') {
      rawMode = true
    } else if (opt.startsWith('--github=')) {
      githubMode = true
      repoFolder = path.resolve(opt.slice('--github='.length))
    } else if (opt.startsWith('--ignore=')) {
      ignoreTypes.push(opt.slice('--ignore='.length))
    } else if (opt.startsWith('--locale=')) {
      const locale = opt.slice('--locale='.length)
      if (['zh', 'en'].includes(locale)) {
        setLocale(locale as LocaleType)
      }
    }
  }

  if (existsSync(interfacePath) && statSync(interfacePath).isDirectory()) {
    interfacePath = path.join(interfacePath, 'interface.json')
  }

  if (!existsSync(interfacePath)) {
    if (githubMode) {
      core.error(`${interfacePath} not found`)
    } else {
      console.error(`${interfacePath} not found`)
    }
    process.exit(1)
  }

  const bundle = new InterfaceBundle(
    new FsContentLoader(),
    new FsContentWatcher(),
    false,
    path.dirname(interfacePath),
    path.basename(interfacePath)
  )
  await bundle.load()
  await bundle.flush(false) // 刷下 imports

  const resourceNames = bundle.allResourceNames()
  if (resourceNames.length === 0) {
    console.log('No resource found')
    process.exit(1)
  }

  const controllerNames = bundle.allControllerNames(true)

  const outputs: Diagnostic[] = []

  for (const controllerName of ['', ...controllerNames]) {
    for (const resourceName of resourceNames) {
      const groupName = controllerName ? `${controllerName}:${resourceName}` : resourceName
      if (!rawMode) {
        if (githubMode) {
          core.startGroup(groupName)
        } else {
          console.log(`Checking ${groupName}`)
        }
      }

      await bundle.switchActive(controllerName, resourceName)

      const diags = performDiagnostic(bundle).filter(diag => !ignoreTypes.includes(diag.type))
      outputs.push(...diags)

      if (rawMode) {
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
        const [start, end, brief] = await buildDiagnosticMessage(bundle.root, diag, locate)

        const [line, col] = start
        const relative = path.relative(bundle.root, diag.file)
        if (githubMode) {
          core[diag.level](brief, {
            file: path.relative(repoFolder, diag.file),
            startLine: line,
            startColumn: col,
            endColumn: col + diag.length
          })
        } else {
          console.log(`  ${diag.level}: ${relative}:${line}:${col} ${brief}`)
        }
      }

      if (githubMode) {
        core.endGroup()
      }
    }
  }

  if (rawMode) {
    console.log(JSON.stringify(outputs))
    process.exit(0)
  } else {
    const hasError = outputs.filter(diag => diag.level === 'error').length > 0
    process.exit(hasError ? 1 : 0)
  }
}

main()
