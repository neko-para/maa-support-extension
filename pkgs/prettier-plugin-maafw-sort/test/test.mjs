import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as prettier from 'prettier'

const file = path.join(import.meta.dirname, 'data.jsonc')
const code = await fs.readFile(file, 'utf8')
const result = await prettier.format(code, {
  parser: 'jsonc',
  plugins: ['./dist/index.mjs']
})
await fs.writeFile(file, result)
