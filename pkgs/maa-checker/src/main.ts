import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
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

async function main() {
  if (process.argv.length < 3) {
    console.log(`Usage: npx ${pkg.name} <interface path>`)
    process.exit(1)
  }
  const interfacePath = process.argv[2]
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

  let hasError = false

  for (const resourceName of resourceNames) {
    console.log(`Checking ${resourceName}`)

    bundle.switchActive(resourceName)

    await new Promise<void>(resolve => {
      bundle.once('bundleReloaded', resolve)
    })

    const diags = performDiagnostic(bundle)

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
      const level = `[${diag.level}]`
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
        case 'int-conflict-option': {
          const prelative = path.relative(bundle.root, diag.previous.file)
          const [pline, pcol] = await locate(diag.previous.file, diag.previous.offset)
          brief = `Conflict option \`${diag.option}\`, previous defined in ${prelative}:${pline}:${pcol}`
          break
        }
        case 'int-unknown-option':
          brief = `Unknown option \`${diag.option}\``
          break
        case 'int-unknown-entry-task':
          brief = `Unknown entry task \`${diag.task}\``
          break
        case 'int-override-unknown-task':
          brief = `Overriding Unknown task \`${diag.task}\``
          break
      }
      console.log(`  ${level} ${relative}:${line}:${col} ${brief}`)
    }

    hasError = hasError || diags.filter(diag => diag.level === 'error').length > 0
  }
  process.exit(hasError ? 1 : 0)
}

main()
