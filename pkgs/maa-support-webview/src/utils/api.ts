import type { ApiMeta, SseMeta } from '@maaxyz/maa-support-types'
import axios from 'axios'
import { onMounted, onUnmounted } from 'vue'

export async function request<Path extends keyof ApiMeta>(
  path: Path,
  req: ApiMeta[Path]['req']
): Promise<ApiMeta[Path]['rsp'] | null> {
  try {
    const resp = await axios({
      url: path,
      method: 'POST',
      data: JSON.stringify(req),
      responseType: 'json'
    })
    return resp.data
  } catch {
    return null
  }
}

let es: EventSource | null = null

export function subscribe<Event extends keyof SseMeta>(
  event: Event,
  func: (data: SseMeta[Event]) => void
) {
  if (es && es.readyState === EventSource.CLOSED) {
    es = null
  }
  if (!es) {
    es = new EventSource('/sse')
  }
  const f = (ev: MessageEvent) => {
    func(JSON.parse(ev.data))
  }
  es.addEventListener(event, f)
  return () => {
    es?.removeEventListener(event, f)
  }
}

export function useSubsribe<Event extends keyof SseMeta>(
  event: Event,
  func: (data: SseMeta[Event]) => void
) {
  let remove = () => {}
  onMounted(() => {
    remove = subscribe(event, func)
  })
  onUnmounted(() => {
    remove()
  })
}
