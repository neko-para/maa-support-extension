import { ref } from 'vue'

import { ipc } from '../ipc'

/** 写入剪贴板，并在短时间内标记刚复制的条目，复制按钮据此给出「已复制」反馈 */
export function useCopy(duration = 1200) {
  const copied = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  function copy(text: string | null | undefined, id = 'default') {
    if (!text) {
      return
    }
    ipc.send({ command: 'writeClipboard', text })
    copied.value = id
    globalThis.clearTimeout(timer)
    timer = globalThis.setTimeout(() => {
      copied.value = null
    }, duration)
  }

  return { copied, copy }
}
