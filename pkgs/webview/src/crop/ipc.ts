import type { CropHostToWeb, CropWebToHost } from '@nekosu/maa-types'

import { useIpc } from '../utils/ipc'

export const ipc = useIpc<CropHostToWeb, CropWebToHost>()
