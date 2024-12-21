import { ref } from 'vue'

export const show = ref(false)

export function toggleShow() {
  show.value = !show.value
}
