import { ref } from 'vue'

import type { RecoInfo } from '../../types/ipc'

export const showRecoInfo = ref(false)
export const recoInfo = ref<RecoInfo | null>(null)
