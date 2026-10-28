import assert from 'node:assert/strict'

export function assertNoSchemaVersion(value: unknown) {
  if (typeof value !== 'object' || value === null) {
    return
  }
  assert.equal(Object.hasOwn(value, 'schemaVersion'), false)
  for (const nested of Object.values(value)) {
    assertNoSchemaVersion(nested)
  }
}
