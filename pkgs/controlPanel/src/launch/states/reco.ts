import { ref } from 'vue'

import type { RecoInfo } from '@mse/types'

export const showRecoInfo = ref(false)
export const recoInfo = ref<RecoInfo | null>(null)
