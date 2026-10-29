import assert from 'node:assert/strict'

export function assertPublicResult(value: unknown) {
  if (Array.isArray(value)) {
    for (const item of value) {
      assertPublicResult(item)
    }
    return
  }
  assert.ok(typeof value === 'object' && value !== null)
  assert.equal('groups' in value, false)
  assert.equal('schemaVersion' in value, false)
  assert.equal('casesWithoutSource' in value, false)
  if ('type' in value && 'result' in value) {
    assertPublicResult(value.result)
  }
}
