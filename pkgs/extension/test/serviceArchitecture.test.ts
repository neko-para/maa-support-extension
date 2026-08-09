import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import test from 'node:test'
import ts from 'typescript'

import {
  type ServiceRegistry,
  agentService,
  nativeService,
  registerServices,
  stateService
} from '../src/service/registry.ts'

const serviceRoot = path.resolve(import.meta.dirname, '../src/service')
const compositionRoot = path.join(serviceRoot, 'index.ts')
const registryFile = path.join(serviceRoot, 'registry.ts')

async function findTypeScriptFiles(folder: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
    const entryPath = path.join(folder, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await findTypeScriptFiles(entryPath)))
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(entryPath)
    }
  }
  return files
}

async function parse(file: string) {
  return ts.createSourceFile(
    file,
    await fs.readFile(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
}

test('registry publishes the composed service instances', () => {
  const services = Object.fromEntries(
    [
      'stateService',
      'nativeService',
      'serverService',
      'shortcutService',
      'rootService',
      'interfaceService',
      'launchService',
      'debugService',
      'commandService',
      'diagnosticService',
      'statusBarService',
      'agentService'
    ].map(name => [name, { name }])
  ) as unknown as ServiceRegistry

  registerServices(services)

  assert.equal(stateService, services.stateService)
  assert.equal(agentService, services.agentService)
})

test('incremental registration preserves services published earlier', () => {
  const state = { name: 'state' }
  const native = { name: 'native' }

  registerServices({ stateService: state } as unknown as Partial<ServiceRegistry>)
  registerServices({ nativeService: native } as unknown as Partial<ServiceRegistry>)

  assert.equal(stateService, state)
  assert.equal(nativeService, native)
})

test('composition root publishes services in construction dependency order', async () => {
  const registrations: [string, string][] = []
  const source = await parse(compositionRoot)

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'publish' &&
      ts.isStringLiteral(node.arguments[0]) &&
      ts.isNewExpression(node.arguments[1]) &&
      ts.isIdentifier(node.arguments[1].expression)
    ) {
      registrations.push([node.arguments[0].text, node.arguments[1].expression.text])
    }
    ts.forEachChild(node, visit)
  }
  visit(source)

  assert.deepEqual(registrations, [
    ['stateService', 'StateService'],
    ['nativeService', 'NativeService'],
    ['statusBarService', 'StatusBarService'],
    ['serverService', 'ServerService'],
    ['shortcutService', 'ShortcutService'],
    ['rootService', 'RootService'],
    ['diagnosticService', 'DiagnosticService'],
    ['interfaceService', 'InterfaceService'],
    ['launchService', 'LaunchService'],
    ['debugService', 'DebugService'],
    ['commandService', 'CommandService'],
    ['agentService', 'AgentService']
  ])
})

test('service implementations do not import the composition root', async () => {
  const violations: string[] = []

  for (const file of await findTypeScriptFiles(serviceRoot)) {
    if (file === compositionRoot) {
      continue
    }

    for (const statement of (await parse(file)).statements) {
      if (
        (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) ||
        !statement.moduleSpecifier ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        continue
      }

      const specifier = statement.moduleSpecifier.text
      if (!specifier.startsWith('.')) {
        continue
      }

      const target = path.resolve(path.dirname(file), specifier)
      if (
        target === serviceRoot ||
        target === path.join(serviceRoot, 'index') ||
        target === compositionRoot
      ) {
        violations.push(`${path.relative(serviceRoot, file)} -> ${specifier}`)
      }
    }
  }

  assert.deepEqual(violations, [])
})

test('service registry has no runtime implementation imports', async () => {
  const runtimeImports = (await parse(registryFile)).statements
    .filter(ts.isImportDeclaration)
    .filter(statement => !statement.importClause?.isTypeOnly)
    .map(statement => statement.moduleSpecifier.getText())

  assert.deepEqual(runtimeImports, [])
})
