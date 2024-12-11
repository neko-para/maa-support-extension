import type { OldWebToHost } from '@mse/types'

import { ipc } from './main'

export function send(msg: OldWebToHost) {
  ipc.postMessage(msg)
}
