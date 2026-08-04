import type { ControlHostToWeb, ControlWebToHost } from '@nekosu/maa-types'

import { useIpc } from '../utils/ipc'

export const ipc = useIpc<ControlHostToWeb, ControlWebToHost>()
