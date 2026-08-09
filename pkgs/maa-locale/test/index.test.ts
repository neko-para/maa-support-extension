import assert from 'node:assert/strict'
import test from 'node:test'

import localeEn from '../src/locale.en.ts'
import localeZhCn from '../src/locale.zh-cn.ts'

function placeholderIndexes(value: string) {
  return [...value.matchAll(/\{(\d+)\}/g)]
    .map(match => Number(match[1]))
    .sort((left, right) => left - right)
}

test('locale dictionaries expose the same keys', () => {
  assert.deepEqual(Object.keys(localeZhCn).sort(), Object.keys(localeEn).sort())
})

test('translations preserve each key placeholder contract', () => {
  for (const key of Object.keys(localeEn) as (keyof typeof localeEn)[]) {
    assert.deepEqual(placeholderIndexes(localeZhCn[key]), placeholderIndexes(localeEn[key]), key)
  }
})
