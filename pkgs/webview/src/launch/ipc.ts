import type { LaunchHostToWeb, LaunchWebToHost } from '@nekosu/maa-types'

import { useIpc } from '../utils/ipc'

export const ipc = useIpc<LaunchHostToWeb, LaunchWebToHost>()
