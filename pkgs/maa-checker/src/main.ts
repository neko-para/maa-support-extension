import * as core from '@actions/core'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
  type Diagnostic,
  FsContentLoader,
  FsContentWatcher,
  InterfaceBundle,
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
`)
    process.exit(1)
  }
  const interfacePath = path.resolve(process.argv[2])
  let rawMode = false
  let githubMode = false
  let repoFolder = process.cwd()
  const ignoreTypes: string[] = []

  rawMode = process.argv[3] === '--raw'
  for (const opt of process.argv.slice(3)) {
    if (opt === '--raw') {
      rawMode = true
    } else if (opt.startsWith('--github=')) {
      githubMode = true
      repoFolder = path.resolve(opt.slice('--github='.length))
    } else if (opt.startsWith('--ignore=')) {
      ignoreTypes.push(opt.slice('--ignore='.length))
    }
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

  const outputs: Diagnostic[] = []

  for (const resourceName of resourceNames) {
    if (!rawMode) {
      if (githubMode) {
        core.startGroup(resourceName)
      } else {
        console.log(`Checking ${resourceName}`)
      }
    }

    bundle.switchActive(resourceName)

    await new Promise<void>(resolve => {
      bundle.once('bundleReloaded', resolve)
    })

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
      const [line, col] = await locate(diag.file, diag.offset)
      const relative = path.relative(bundle.root, diag.file)
      let brief: string = diag.type
      switch (diag.type) {
        case 'conflict-task': {
          const prelative = path.relative(bundle.root, diag.previous.file)
          const [pline, pcol] = await locate(diag.previous.file, diag.previous.offset)
          brief = `Conflict task \`${diag.task}\`, previous defined in ${prelative}:${pline}:${pcol}`
          break
        }
        case 'duplicate-next':
          brief = `Duplicate route \`${diag.task}\``
          break
        case 'unknown-task':
          brief = `Unknown task \`${diag.task}\``
          break
        case 'dynamic-image':
          brief = `Dynamic image path detected`
          break
        case 'image-path-back-slash':
          brief = `Image path contains backslash`
          break
        case 'image-path-dot-slash':
          brief = `Image path contains ./`
          break
        case 'image-path-missing-png':
          brief = `Image path missing .png`
          break
        case 'unknown-image':
          brief = `Unknown image \`${diag.image}\``
          break
        case 'unknown-anchor':
          brief = `Unknown anchor \`${diag.anchor}\``
          break
        case 'unknown-attr':
          brief = `Unknown attribute \`${diag.attr}\``
          break
        case 'int-conflict-controller': {
          const prelative = path.relative(bundle.root, diag.previous.file)
          const [pline, pcol] = await locate(diag.previous.file, diag.previous.offset)
          brief = `Conflict controller \`${diag.ctrl}\`, previous defined in ${prelative}:${pline}:${pcol}`
          break
        }
        case 'int-unknown-controller':
          brief = `Unknown controlle \`${diag.ctrl}\``
          break
        case 'int-conflict-resource': {
          const prelative = path.relative(bundle.root, diag.previous.file)
          const [pline, pcol] = await locate(diag.previous.file, diag.previous.offset)
          brief = `Conflict resource \`${diag.res}\`, previous defined in ${prelative}:${pline}:${pcol}`
          break
        }
        case 'int-unknown-resource':
          brief = `Unknown resource \`${diag.res}\``
          break
        case 'int-conflict-option': {
          const prelative = path.relative(bundle.root, diag.previous.file)
          const [pline, pcol] = await locate(diag.previous.file, diag.previous.offset)
          brief = `Conflict option \`${diag.option}\`, previous defined in ${prelative}:${pline}:${pcol}`
          break
        }
        case 'int-unknown-option':
          brief = `Unknown option \`${diag.option}\``
          break
        case 'int-conflict-case': {
          const prelative = path.relative(bundle.root, diag.previous.file)
          const [pline, pcol] = await locate(diag.previous.file, diag.previous.offset)
          brief = `Conflict case \`${diag.case}\` for option \`${diag.option}\`, previous defined in ${prelative}:${pline}:${pcol}`
          break
        }
        case 'int-unknown-case':
          brief = `Unknown case \`${diag.case}\` for option \`${diag.option}\``
          break
        case 'int-switch-name-invalid':
          brief = `Switch name invalid`
          break
        case 'int-switch-missing':
          if (diag.missingYes && diag.missingNo) {
            brief = `Switch option missing \`Yes\` and \`No\``
          } else if (diag.missingYes) {
            brief = `Switch option missing \`Yes\``
          } else {
            brief = `Switch option missing \`No\``
          }
          break
        case 'int-switch-should-fixed':
          brief = `Switch name should use \`Yes\` or \`No\``
          break
        case 'int-unknown-entry-task':
          brief = `Unknown entry task \`${diag.task}\``
          break
        case 'int-override-unknown-task':
          brief = `Overriding Unknown task \`${diag.task}\``
          break
      }
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

  if (rawMode) {
    console.log(JSON.stringify(outputs))
    process.exit(0)
  } else {
    const hasError = outputs.filter(diag => diag.level === 'error').length > 0
    process.exit(hasError ? 1 : 0)
  }
}

main()
