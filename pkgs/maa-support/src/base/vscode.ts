import axios from 'axios'

import { handle } from '../server'
import { BaseService } from './base'

export class VscodeService extends BaseService {
  hostPort: number | null = null

  listen() {
    handle('/host/forward', async req => {
      if (!this.hostPort) {
        console.log('no host!')
        return {
          data: null
        }
      }
      try {
        const resp = await axios({
          baseURL: `http://localhost:${this.hostPort}`,
          url: `/${req.method}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          data: JSON.stringify(req.data),
          responseType: 'json'
        })
        return {
          data: resp.data
        }
      } catch {
        return {
          data: null
        }
      }
    })
  }
}
