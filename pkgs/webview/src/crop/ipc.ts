import type { CropHostToWeb, CropWebToHost } from '@mse/types'

import { useIpc } from '../utils/ipc'

export const ipc = useIpc<CropHostToWeb, CropWebToHost>()

ipc.send({
  command: '__init',
  builtin: true
})
