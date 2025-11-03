import express, { type Express } from 'express'

import { services } from '../base'

let app: Express

export function setupServer(port: number) {
  app = express()

  for (const service of services) {
    service.listen(app)
  }

  app.listen(port)
}
