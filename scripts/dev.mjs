import * as path from 'node:path'
import nodemon from 'nodemon'

import { buildExtension, buildSupport, buildSupportWeb } from './utils.mjs'

buildExtension('watch')
buildSupport('watch')
buildSupportWeb('dev')

nodemon({
  script: path.resolve(import.meta.dirname, '../release/support/index.js'),
  args: ['--chdir', path.resolve(import.meta.dirname, '../../M9A')]
})

console.log('http://localhost:60003?maa_port=60002')
