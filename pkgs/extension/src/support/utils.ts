import { ApiMeta } from '@maaxyz/maa-support-types'
import axios from 'axios'

export async function request<Path extends keyof ApiMeta>(
  path: Path,
  req: ApiMeta[Path]['req']
): Promise<ApiMeta[Path]['rsp'] | null> {
  try {
    const resp = await axios({
      baseURL: 'http://localhost:60002',
      url: `/api${path}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      data: JSON.stringify(req),
      responseType: 'json'
    })
    return resp.data
  } catch {
    return null
  }
}
