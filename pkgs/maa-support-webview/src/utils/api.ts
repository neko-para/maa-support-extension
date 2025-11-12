import type { ApiMeta, HostApiMeta, SseMeta } from '@maaxyz/maa-support-types'
import axios from 'axios'
import { onMounted, onUnmounted, shallowRef } from 'vue'

const host = 'http://localhost:60002'

export async function request<Path extends keyof ApiMeta>(
  path: Path,
  req: ApiMeta[Path]['req']
): Promise<ApiMeta[Path]['rsp'] | null> {
  try {
    const resp = await axios({
      baseURL: host,
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

export async function requestHost<Method extends keyof HostApiMeta>(
  method: Method,
  req: HostApiMeta[Method]['req']
): Promise<HostApiMeta[Method]['rsp'] | null> {
  const result = await request('/host/forward', {
    method,
    data: req
  })
  if (result === null) {
    return null
  } else {
    return result.data as HostApiMeta[Method]['rsp']
  }
}

export const es = shallowRef<EventSource | null>(null)
const handlers: Record<string, (ev: MessageEvent) => void> = {}
const reconnectHandlers: (() => void)[] = []

function ensureConnection() {
  if (es.value && es.value.readyState === EventSource.CLOSED) {
    console.log('已断开')
    es.value = null
  }
  if (!es.value) {
    es.value = new EventSource(host + '/api/sse')
    for (const [event, func] of Object.entries(handlers)) {
      es.value.addEventListener(event, func)
    }
    for (const reconn of reconnectHandlers) {
      reconn()
    }
    es.value.addEventListener('error', () => {
      console.log('已断开')
      es.value = null
      setTimeout(() => {
        ensureConnection()
      }, 5000)
    })
    es.value.addEventListener('open', () => {
      console.log('已连接')
    })
  }
}

export function subscribe<Event extends keyof SseMeta>(
  event: Event,
  func: (data: SseMeta[Event]) => void,
  reconnect?: () => void
) {
  ensureConnection()

  const f = (ev: MessageEvent) => {
    func(JSON.parse(ev.data))
  }
  handlers[event] = f
  if (reconnect) {
    reconnectHandlers.push(reconnect)
  }
  es.value!.addEventListener(event, f)
  return () => {
    delete handlers[event]
    es.value?.removeEventListener(event, f)
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
