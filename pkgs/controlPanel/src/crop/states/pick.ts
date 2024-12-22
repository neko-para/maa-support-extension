import { ref } from 'vue'

export const picking = ref(false)

export const color = ref<[r: number, g: number, b: number] | null>(null)

export function start() {
  picking.value = true
  color.value = null
}
