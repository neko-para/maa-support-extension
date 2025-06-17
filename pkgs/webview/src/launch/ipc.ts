import type { LaunchHostToWeb, LaunchWebToHost } from '@mse/types'

import { useIpc } from '../utils/ipc'

export const ipc = useIpc<LaunchHostToWeb, LaunchWebToHost>()

ipc.send({
  command: '__init',
  builtin: true
})
