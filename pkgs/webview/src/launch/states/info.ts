import { ref } from 'vue'

import type { RecoInfo } from '@mse/types'

export const recoInfo = ref<RecoInfo | null>(null)
export const taskInfo = ref<[task: string, json: string | null] | null>(null)
