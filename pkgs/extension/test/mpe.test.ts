import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  hasDocumentVersionConflict,
  isCompatibleMpeMessage,
  isMpeReadyForRequest,
  mpeProtocol,
  mpeProtocolVersion,
  normalizeExternalUrl,
  parsePipeline,
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

test('delegates document conflict choices to the MPE protocol', () => {
  const source = readFileSync(new URL('../src/service/mpe.ts', import.meta.url), 'utf8')

  assert.match(source, /!pending\.force/)
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
