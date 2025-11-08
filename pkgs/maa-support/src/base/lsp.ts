import { setupLsp } from '../lsp/connection'
import { handle } from '../server'
import { BaseService } from './base'

export class LspService extends BaseService<{
  statusChanged: [loaded: boolean]
}> {
  listen() {
    handle('/lsp/start', req => {
      setupLsp(req.port, () => {
        this.emitter.emit('statusChanged', false)
      })
      this.emitter.emit('statusChanged', true)
      return {}
    })
  }
}
