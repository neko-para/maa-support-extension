import { ref } from 'vue'

export const showTab = ref<null | 'settings' | 'tool'>(null)

export function toggleShow(target: 'settings' | 'tool') {
  if (showTab.value === target) {
    showTab.value = null
  } else {
    showTab.value = target
  }
}
