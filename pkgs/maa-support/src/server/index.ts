import { ApiMeta, SseMeta } from '@maaxyz/maa-support-types'
import express, { type Express, type Response, json } from 'express'

import { services } from '../base'

let app: Express

const sseClients: Set<Response> = new Set()

export function setupServer(port: number) {
  app = express()

  app.use(json())

  for (const service of services) {
    service.listen()
  }

  app.get('/api/sse', (req, rsp) => {
    rsp.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    })
    rsp.write(':ok\n\n')

    sseClients.add(rsp)
    req.on('close', () => {
      sseClients.delete(rsp)
    })
  })

  app.listen(port)
}

export function handle<Path extends keyof ApiMeta>(
  path: Path,
  func: (req: ApiMeta[Path]['req']) => ApiMeta[Path]['rsp'] | Promise<ApiMeta[Path]['rsp']>
) {
  app.post(`/api${path}`, async (req, rsp) => {
    const result = await func(req.body)
    rsp.send(result)
  })
  app.get(`/api${path}`, async (req, rsp) => {
    let obj: any = {}
    if (req.query.req) {
      obj = JSON.parse(req.query.req as string)
    }
    const result = await func(obj)
    rsp.send(result)
  })
}

export function pushEvent<Event extends keyof SseMeta>(event: Event, data: SseMeta[Event]) {
  const content = `
event: ${event}
data: ${JSON.stringify(data)}

`
  for (const client of sseClients) {
    client.write(content)
  }
}
