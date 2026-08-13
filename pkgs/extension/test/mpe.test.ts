import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import test from 'node:test'

import {
  beginMpeLoad,
  finishMpeLoad,
  hasDocumentVersionConflict,
  isCompatibleMpeMessage,
  isCurrentDocumentSnapshot,
  isMpeReadyForRequest,
  isMpeSaveAllowed,
  isSeparatedMpeSidecar,
  isSidecarNotFound,
  mergePipelineAndConfig,
  mpeProtocol,
  mpeProtocolVersion,
  mpeSidecarPath,
  normalizeExternalUrl,
  parseMpeConfig,
  parsePipeline,
  splitPipelineAndConfig,
  stringifyMpeConfig,
  updatePipelineText
} from '../src/service/mpeProtocol.ts'

test('parses JSONC pipeline content', () => {
  assert.deepEqual(parsePipeline('{ // task\n "A": { "next": ["B",], },\n}'), {
    A: { next: ['B'] }
  })
})

test('updates pipeline keys while preserving unrelated comments', () => {
  const original = '{\n  // keep this comment\n  "A": { "next": ["B"] },\n  "B": {}\n}\n'
  const previous = parsePipeline(original)
  const next = { A: { next: ['C'] }, C: {} }
  const result = updatePipelineText(original, previous, next)

  assert.match(result, /keep this comment/)
  assert.deepEqual(parsePipeline(result), next)
})

test('updates pipeline keys with complete snapshot deletion semantics', () => {
  const original = '{\n  "A": {},\n  "B": {}\n}\n'
  const result = updatePipelineText(original, parsePipeline(original), { A: { next: ['C'] } })

  assert.deepEqual(parsePipeline(result), { A: { next: ['C'] } })
})

test('detects document changes before and during an MPE save', () => {
  assert.equal(hasDocumentVersionConflict(3, 3, 3), false)
  assert.equal(hasDocumentVersionConflict(3, 4, 4), true)
  assert.equal(hasDocumentVersionConflict(3, 3, 4), true)
  assert.equal(hasDocumentVersionConflict(undefined, 3, 3), false)
})

test('accepts a snapshot only when it matches the current document version', () => {
  assert.equal(isCurrentDocumentSnapshot(3, 3), true)
  assert.equal(isCurrentDocumentSnapshot(3, 4), false)
})

test('delegates document conflict choices to the MPE protocol', () => {
  const source = readFileSync(new URL('../src/service/mpe.ts', import.meta.url), 'utf8')

  assert.match(source, /pending\.force/)
  assert.match(source, /rejectIfChanged/)
  assert.match(source, /code: 'document_changed'/)
  assert.match(source, /canForce: true/)
  assert.doesNotMatch(source, /showWarningMessage\(/)
})

test('MPE host identifies itself with the MSE product name', () => {
  const source = readFileSync(new URL('../src/service/mpe.ts', import.meta.url), 'utf8')

  assert.match(source, /host: \{ id: 'mse', name: 'MSE', repositoryUrl \}/)
})

test('rejects malformed and non-object pipeline content', () => {
  assert.throws(() => parsePipeline('{ invalid }'), /parse failed/)
  assert.throws(() => parsePipeline('[]'), /JSON object/)
})

test('MPE host resets VS Code webview body spacing', () => {
  const source = readFileSync(new URL('../src/service/mpe.ts', import.meta.url), 'utf8')

  assert.match(source, /html,body\{[^}]*margin:0;[^}]*padding:0;/)
  assert.match(source, /iframe\{display:block;width:100%;height:100%;border:0\}/)
})

test('MPE host only accepts HTTP(S) external URLs', () => {
  assert.equal(normalizeExternalUrl('https://example.com/docs'), 'https://example.com/docs')
  assert.equal(
    normalizeExternalUrl('http://localhost:5173/help?q=1'),
    'http://localhost:5173/help?q=1'
  )
  assert.equal(normalizeExternalUrl('javascript:alert(1)'), null)
  assert.equal(normalizeExternalUrl('file:///C:/secret.txt'), null)
  assert.equal(normalizeExternalUrl('not a url'), null)
  assert.equal(normalizeExternalUrl(undefined), null)
})

test('validates MPE protocol versions and init request correlation', () => {
  const ready = {
    protocol: mpeProtocol,
    version: mpeProtocolVersion,
    type: 'mpe:ready',
    requestId: 'init-1'
  }

  assert.equal(isCompatibleMpeMessage(ready), true)
  assert.equal(isCompatibleMpeMessage({ ...ready, version: '2.0.0' }), false)
  assert.equal(isCompatibleMpeMessage({ ...ready, protocol: 'other' }), false)
  assert.equal(isMpeReadyForRequest(ready, 'init-1'), true)
  assert.equal(isMpeReadyForRequest(ready, 'init-2'), false)
  assert.equal(isMpeReadyForRequest({ ...ready, type: 'mpe:loadResult' }, 'init-1'), false)
})

test('MPE host uses a nonce for its inline bridge script', () => {
  const source = readFileSync(new URL('../src/service/mpe.ts', import.meta.url), 'utf8')

  assert.match(source, /script-src 'nonce-\$\{nonce\}'/)
  assert.match(source, /<script nonce="\$\{nonce\}">/)
  assert.doesNotMatch(source, /script-src 'unsafe-inline'/)
})

test('MPE document lifecycle closes the underlying webview panel', () => {
  const source = readFileSync(new URL('../src/service/mpe.ts', import.meta.url), 'utf8')

  assert.match(source, /onDidCloseTextDocument\(doc => \{[\s\S]*?\.close\(\)\r?\n[ \t]{4}\}\)/)
  assert.match(
    source,
    /close\(\) \{\r?\n[ \t]{4}if \(!this\.disposed\) this\.panel\.dispose\(\)\r?\n[ \t]{2}\}/
  )
})

test('MPE iframe delegates clipboard permissions to the embedded editor', () => {
  const source = readFileSync(new URL('../src/service/mpe.ts', import.meta.url), 'utf8')

  assert.match(source, /allow="clipboard-read; clipboard-write; clipboard-sanitized-write"/)
})

test('resolves the hidden MPE sidecar next to a pipeline file', () => {
  const pipelineJson = path.join('/proj', 'pipeline', 'fight.json')
  const pipelineJsonc = path.join('/proj', 'pipeline', 'fight.jsonc')
  const sidecar = path.join('/proj', 'pipeline', '.fight.mpe.json')

  assert.equal(mpeSidecarPath(pipelineJson), sidecar)
  assert.equal(mpeSidecarPath(pipelineJsonc), sidecar)
})

test('treats only a missing sidecar as integrated mode', () => {
  assert.equal(isSidecarNotFound({ code: 'FileNotFound' }), true)
  assert.equal(isSidecarNotFound({ code: 'ENOENT' }), true)
  assert.equal(isSidecarNotFound({ code: 'NoPermissions' }), false)
  assert.equal(isSidecarNotFound({ code: 'Unavailable' }), false)
  assert.equal(isSidecarNotFound(new Error('MPE config JSONC parse failed')), false)
  assert.equal(isSidecarNotFound(undefined), false)

  const missing = { status: 'missing' as const }
  const ok = {
    status: 'ok' as const,
    config: { file_config: { filename: 'fight' }, node_configs: {} }
  }
  const invalid = { status: 'invalid' as const, error: new Error('conflict') }

  assert.equal(isSeparatedMpeSidecar(false, missing), false)
  assert.equal(isSeparatedMpeSidecar(true, missing), true)
  assert.equal(isSeparatedMpeSidecar(false, ok), true)
  assert.equal(isSeparatedMpeSidecar(false, invalid), true)
})

test('rejects sidecar configs with wrong field types', () => {
  assert.throws(
    () => parseMpeConfig('{"file_config": [], "node_configs": {}}'),
    /file_config must be an object/
  )
  assert.throws(
    () => parseMpeConfig('{"file_config": {}, "node_configs": "conflict"}'),
    /node_configs must be an object/
  )
  assert.throws(
    () => parseMpeConfig('{"file_config": {}, "node_configs": {}, "external_nodes": []}'),
    /external_nodes must be an object/
  )
  assert.throws(
    () => parseMpeConfig('{"file_config": {}, "node_configs": {}, "sticker_nodes": null}'),
    /sticker_nodes must be an object/
  )
})

test('parses a separated MPE config file', () => {
  const config = parseMpeConfig(`{
    // layout
    "file_config": { "filename": "fight" },
    "node_configs": { "Start": { "position": { "x": 10, "y": 20 } } },
  }`)

  assert.equal(config.file_config.filename, 'fight')
  assert.deepEqual(config.node_configs.Start, { position: { x: 10, y: 20 } })
})

test('merges a sidecar config into pipeline nodes for MPE load', () => {
  const pipeline = {
    Start: { next: ['End'] },
    End: {}
  }
  const merged = mergePipelineAndConfig(
    pipeline,
    {
      file_config: { filename: 'fight', coordinateMode: 'absolute-v1' },
      node_configs: {
        Start: { position: { x: 12, y: 34 }, handleDirection: 'horizontal' },
        End: { position: { x: 56, y: 78 }, extra_positions: [{ x: 1, y: 2 }] }
      },
      external_nodes: {
        Shared: { position: { x: 9, y: 8 } }
      }
    },
    'fight',
    Object.keys(pipeline)
  )

  assert.deepEqual(merged['$__mpe_config_fight'], {
    $__mpe_code: { filename: 'fight', coordinateMode: 'absolute-v1' }
  })
  assert.deepEqual(merged.Start, {
    next: ['End'],
    $__mpe_code: { position: { x: 12, y: 34 }, handleDirection: 'horizontal' }
  })
  assert.deepEqual(merged.End, {
    $__mpe_code: {
      position: { x: 56, y: 78 },
      extra_positions: [{ x: 1, y: 2 }]
    }
  })
  assert.deepEqual(merged['$__mpe_external_Shared_fight'], {
    $__mpe_code: { position: { x: 9, y: 8 } }
  })
})

test('splits MPE save data back into a clean pipeline and sidecar config', () => {
  const { pipeline, config } = splitPipelineAndConfig({
    $__mpe_config_fight: {
      $__mpe_code: { filename: 'fight', coordinateMode: 'absolute-v1' }
    },
    Start: {
      next: ['End'],
      $__mpe_code: { position: { x: 12, y: 34 }, handleDirection: 'horizontal' }
    },
    End: {},
    $__mpe_sticker_Note_fight: {
      $__mpe_code: { position: { x: 1, y: 2 }, text: 'note' }
    }
  })

  assert.deepEqual(pipeline, {
    Start: { next: ['End'] },
    End: {}
  })
  assert.deepEqual(config.file_config, { filename: 'fight', coordinateMode: 'absolute-v1' })
  assert.deepEqual(config.node_configs.Start, {
    position: { x: 12, y: 34 },
    handleDirection: 'horizontal'
  })
  assert.equal(config.node_configs.End, undefined)
  assert.deepEqual(config.sticker_nodes?.Note, { position: { x: 1, y: 2 }, text: 'note' })
  assert.match(stringifyMpeConfig(config), /"filename": "fight"/)
})

test('MPE host loads and writes the separated sidecar config', () => {
  const source = readFileSync(new URL('../src/service/mpe.ts', import.meta.url), 'utf8')

  assert.match(source, /readSidecar/)
  assert.match(source, /isSidecarNotFound/)
  assert.match(source, /isSeparatedMpeSidecar/)
  assert.match(source, /code: 'invalid_config'/)
  assert.match(source, /errorCode\(error, 'invalid_pipeline'\)/)
  assert.match(source, /mergePipelineAndConfig/)
  assert.match(source, /splitPipelineAndConfig/)
  assert.match(source, /appendSidecarEdit/)
  assert.match(source, /status: 'missing' as const/)
  assert.match(source, /status: 'invalid' as const/)
})

test('blocks MPE save until a host load succeeds', () => {
  let auth = beginMpeLoad()
  assert.equal(isMpeSaveAllowed(auth), false)

  auth = finishMpeLoad(false)
  assert.equal(isMpeSaveAllowed(auth), false)

  auth = finishMpeLoad(true)
  assert.equal(isMpeSaveAllowed(auth), true)

  auth = beginMpeLoad()
  assert.equal(isMpeSaveAllowed(auth), false)
})

test('MPE host only accepts save after a successful load', () => {
  const source = readFileSync(new URL('../src/service/mpe.ts', import.meta.url), 'utf8')

  assert.match(source, /this\.loadAuth = beginMpeLoad\(\)/)
  assert.match(source, /this\.loadAuth = finishMpeLoad\(true\)/)
  assert.match(source, /this\.loadAuth = finishMpeLoad\(false\)/)
  assert.match(source, /!isMpeSaveAllowed\(this\.loadAuth\)/)
  assert.match(source, /code: 'save_blocked'/)
  assert.match(source, /请先加载成功再保存/)
})

test('MPE host binds the loaded version to the parsed snapshot', () => {
  const source = readFileSync(new URL('../src/service/mpe.ts', import.meta.url), 'utf8')

  assert.match(source, /isCurrentDocumentSnapshot\(version, this\.document\.version\)/)
  assert.match(source, /loadedDocumentVersion = snapshot\.version/)
  assert.match(source, /seq !== this\.loadSeq/)
})

test('MPE host writes pipeline and sidecar in one WorkspaceEdit', () => {
  const source = readFileSync(new URL('../src/service/mpe.ts', import.meta.url), 'utf8')

  assert.match(source, /appendSidecarEdit\(edit, sidecarUri, next\.config\)/)
  assert.match(source, /edit\.createFile\(uri, \{/)
  assert.match(
    source,
    /edit\.replace\(this\.document\.uri, documentRange\(this\.document\), pipelineText\)/
  )
  assert.doesNotMatch(source, /workspace\.fs\.writeFile/)
  assert.doesNotMatch(source, /writeSidecar/)
})
