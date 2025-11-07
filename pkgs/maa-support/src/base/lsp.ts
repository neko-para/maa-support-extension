import { setupLsp } from '../lsp/connection'
import { handle } from '../server'
import { BaseService } from './base'

export class LspService extends BaseService {
  listen() {
    handle('/lsp/start', req => {
      setupLsp(req.port)
      return {}
    })
  }
}
