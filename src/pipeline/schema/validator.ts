import Ajv, { ValidateFunction } from 'ajv'

import interfaceSchema from './interface.schema.json'
import pipelineSchema from './pipeline.schema.json'

const ajv = new Ajv({
  schemas: {
    'https://json-schema.org/draft-07/schema': {},
    'pipeline.schema.json': pipelineSchema,
    'interface.schema.json': interfaceSchema
  }
})

const pipelineValidator = ajv.getSchema('pipeline.schema.json') as ValidateFunction
const interfaceValidator = ajv.getSchema('interface.schema.json') as ValidateFunction

export function validateJson(type: 'interface' | 'pipeline', data: unknown) {
  let validator: ValidateFunction
  switch (type) {
    case 'interface':
      validator = interfaceValidator
      break
    case 'pipeline':
      validator = pipelineValidator
      break
  }
  const valid = validator(data)
  if (!valid) {
    return validator.errors ?? []
  } else {
    return null
  }
}
