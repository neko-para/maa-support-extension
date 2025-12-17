import { ref } from 'vue'

import type { ActionInfo, RecoInfo } from '@mse/types'

export const recoInfo = ref<RecoInfo | null>(null)
export const actInfo = ref<ActionInfo | null>(null)
export const taskInfo = ref<[task: string, json: string | null] | null>(null)
