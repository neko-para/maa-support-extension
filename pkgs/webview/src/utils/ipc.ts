import type { HostToWeb, ImplType, WebToHost } from '@mse/types'

export function useIpc<ToWebImpl extends ImplType, ToHostImpl extends ImplType>() {
  type ToWeb = HostToWeb<ToWebImpl>
  type ToHost = WebToHost<ToHostImpl>

  const api = typeof acquireVsCodeApi !== 'function' ? undefined : acquireVsCodeApi()

  let send: (data: ToHost) => void = () => {}

  send = api
    ? (data: ToHost) => {
        api.postMessage(JSON.stringify(data))
      }
    : (data: ToHost) => {
        window.parent.postMessage(JSON.stringify(data), '*')
      }

  let seq = 0
  const resps = new Map<number, (resp: unknown) => void>()
  const call = (data: ToHost) => {
    seq += 1
    send({
      ...data,
      seq
    })
    return new Promise<unknown>(resolve => {
      resps.set(seq, resolve)
    })
  }

  const recv: {
    value: (data: ToWeb) => void
  } = {
    value: () => {}
  }

  // const stateInner = ref<unknown>({})
  // const state = computed(() => {
  //   return stateInner.value
  // })

  window.addEventListener('message', event => {
    const obj = JSON.parse(event.data) as ToWeb
    if (obj.builtin) {
      switch (obj.command) {
        case '__updateBodyClass':
          document.documentElement.setAttribute('style', obj.htmlStyle)
          document.body.setAttribute('class', obj.bodyClass)
          break
        case '__response':
          const resolve = resps.get(obj.seq)!
          resps.delete(obj.seq)
          resolve?.(obj.data)
          break
      }
    } else {
      recv.value(obj)
    }
  })

  if (import.meta.env.DEV) {
    document.addEventListener('keydown', e => {
      send({
        command: '__keyDown',
        data: {
          key: e.key,
          code: e.code,
          altKey: e.altKey,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          metaKey: e.metaKey,
          repeat: e.repeat
        },
        builtin: true
      })
    })
  }

  return {
    send,
    call,
    recv
  }
}
