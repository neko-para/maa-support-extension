import type { ControlHostToWeb, ControlWebToHost } from '@mse/types'

import { useIpc } from '../utils/ipc'

export const ipc = useIpc<ControlHostToWeb, ControlWebToHost>()

ipc.send({
  command: '__init',
  builtin: true
})
