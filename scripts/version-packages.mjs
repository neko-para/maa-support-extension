import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'

const releaseTypes = new Set(['major', 'minor', 'patch'])
const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

function parseStableVersion(version) {
  const match = stableVersionPattern.exec(version)
  if (!match) {
    throw new Error(`Expected a stable semantic version, received ${version}`)
  }
  return match.slice(1).map(Number)
}

function compareVersions(left, right) {
  const leftParts = parseStableVersion(left)
  const rightParts = parseStableVersion(right)
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index]
    }
  }
  return 0
}

export function resolveNextVersion(currentVersion, release) {
  const [major, minor, patch] = parseStableVersion(currentVersion)
  if (releaseTypes.has(release)) {
    if (release === 'major') {
      return `${major + 1}.0.0`
    }
    if (release === 'minor') {
      return `${major}.${minor + 1}.0`
    }
    return `${major}.${minor}.${patch + 1}`
  }

  parseStableVersion(release)
  if (compareVersions(release, currentVersion) <= 0) {
    throw new Error(`Version ${release} must be newer than ${currentVersion}`)
  }
  return release
}

export function parseBumpRequest(value) {
  const separator = value.lastIndexOf('=')
  if (separator <= 0 || separator === value.length - 1) {
    throw new Error(`Invalid bump request ${value}; expected <package>=<major|minor|patch|version>`)
  }
  return {
    selector: value.slice(0, separator),
    release: value.slice(separator + 1)
  }
}

export async function loadPublishedPackages(repoRoot) {
  const packagesRoot = path.join(repoRoot, 'pkgs')
  const records = []

  for (const entry of await fs.readdir(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }

    const manifestPath = path.join(packagesRoot, entry.name, 'package.json')
    let manifest
    try {
      manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    } catch (error) {
      if (error?.code === 'ENOENT') {
        continue
      }
      throw error
    }

    if (!manifest.name?.startsWith('@nekosu/') || manifest.publishConfig?.access !== 'public') {
      continue
    }

    records.push({
      name: manifest.name,
      dir: entry.name,
      version: manifest.version,
      dependencies: [],
      manifest,
      manifestPath
    })
  }

  const names = new Set(records.map(record => record.name))
  for (const record of records) {
    record.dependencies = Object.entries(record.manifest.dependencies ?? {})
      .filter(([name, specifier]) => names.has(name) && specifier.startsWith('workspace:'))
      .map(([name]) => name)
      .sort()
  }

  return records.sort((left, right) => left.name.localeCompare(right.name))
}

function topologicalOrder(packages) {
  const packagesByName = new Map(packages.map(pkg => [pkg.name, pkg]))
  const visiting = new Set()
  const visited = new Set()
  const result = []

  function visit(name) {
    if (visited.has(name)) {
      return
    }
    if (visiting.has(name)) {
      throw new Error(`Published package dependency cycle detected at ${name}`)
    }

    visiting.add(name)
    const pkg = packagesByName.get(name)
    for (const dependency of pkg.dependencies) {
      visit(dependency)
    }
    visiting.delete(name)
    visited.add(name)
    result.push(name)
  }

  for (const pkg of packages) {
    visit(pkg.name)
  }
  return result
}

export function planVersionBumps(packages, requests) {
  const packagesByName = new Map(packages.map(pkg => [pkg.name, pkg]))
  const packagesBySelector = new Map()
  for (const pkg of packages) {
    packagesBySelector.set(pkg.name, pkg)
    packagesBySelector.set(pkg.dir, pkg)
  }

  const plan = new Map()
  for (const request of requests) {
    const pkg = packagesBySelector.get(request.selector)
    if (!pkg) {
      throw new Error(`Unknown published package ${request.selector}`)
    }
    if (plan.has(pkg.name)) {
      throw new Error(`Package ${pkg.name} was requested more than once`)
    }
    plan.set(pkg.name, {
      ...pkg,
      nextVersion: resolveNextVersion(pkg.version, request.release),
      explicit: true,
      reasons: [`requested ${request.release}`]
    })
  }

  const dependents = new Map(packages.map(pkg => [pkg.name, []]))
  for (const pkg of packages) {
    for (const dependency of pkg.dependencies) {
      dependents.get(dependency).push(pkg.name)
    }
  }
  for (const names of dependents.values()) {
    names.sort()
  }

  const queue = [...plan.keys()]
  const queued = new Set(queue)
  for (let index = 0; index < queue.length; index += 1) {
    const dependency = queue[index]
    for (const dependentName of dependents.get(dependency)) {
      let entry = plan.get(dependentName)
      if (!entry) {
        const pkg = packagesByName.get(dependentName)
        entry = {
          ...pkg,
          nextVersion: resolveNextVersion(pkg.version, 'patch'),
          explicit: false,
          reasons: []
        }
        plan.set(dependentName, entry)
      }
      entry.reasons.push(`depends on ${dependency}`)
      if (!queued.has(dependentName)) {
        queued.add(dependentName)
        queue.push(dependentName)
      }
    }
  }

  return topologicalOrder(packages)
    .filter(name => plan.has(name))
    .map(name => plan.get(name))
}

export async function writeVersionPlan(plan) {
  for (const entry of plan) {
    entry.manifest.version = entry.nextVersion
    await fs.writeFile(entry.manifestPath, `${JSON.stringify(entry.manifest, null, 2)}\n`)
  }
}

function printUsage() {
  console.log(`Usage:
  pnpm version-packages [--write] <package>=<major|minor|patch|version> [...]

Examples:
  pnpm version-packages maa-tasker=minor
  pnpm version-packages --write @nekosu/maa-version-manager=patch`)
}

async function main(argv) {
  const write = argv.includes('--write')
  const values = argv.filter(value => value !== '--write')
  if (values.includes('--help') || values.includes('-h')) {
    printUsage()
    return
  }
  if (values.length === 0) {
    printUsage()
    process.exitCode = 1
    return
  }

  const repoRoot = path.resolve(import.meta.dirname, '..')
  const packages = await loadPublishedPackages(repoRoot)
  const plan = planVersionBumps(packages, values.map(parseBumpRequest))

  console.log(write ? 'Writing package version plan:' : 'Package version plan (preview):')
  for (const entry of plan) {
    console.log(
      `  ${entry.name}: ${entry.version} -> ${entry.nextVersion} (${entry.reasons.join(', ')})`
    )
  }

  if (write) {
    await writeVersionPlan(plan)
    console.log('Updated package manifests. Review and commit all listed packages together.')
  } else {
    console.log('No files changed. Pass --write to apply this plan.')
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
