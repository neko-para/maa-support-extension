import express, { type Express, json } from 'express'

import { services } from '../base'
import { ApiMeta } from './api'

let app: Express

export function setupServer(port: number) {
  app = express()

  app.use(json())

  for (const service of services) {
    service.listen()
  }

  app.listen(port)
}

export function handle<Path extends keyof ApiMeta>(
  path: Path,
  func: (req: ApiMeta[Path]['req']) => ApiMeta[Path]['rsp'] | Promise<ApiMeta[Path]['rsp']>
) {
  app.post(path, async (req, rsp) => {
    const result = await func(req.body)
    rsp.send(result)
  })
  app.get(path, async (req, rsp) => {
    let obj: any = {}
    if (req.query.req) {
      obj = JSON.parse(req.query.req as string)
    }
    const result = await func(obj)
    rsp.send(result)
  })
}
