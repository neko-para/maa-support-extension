import { ApiMeta } from '@maaxyz/maa-support-types'
import axios from 'axios'

export async function request<Path extends keyof ApiMeta>(
  path: Path,
  req: ApiMeta[Path]['req']
): Promise<ApiMeta[Path]['rsp'] | null> {
  try {
    const resp = await axios({
      url: `/api${path}`,
      method: 'POST',
      data: JSON.stringify(req),
      responseType: 'json'
    })
    return resp.data
  } catch {
    return null
  }
}
