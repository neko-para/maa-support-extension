import { ref } from 'vue'

export const tooltipDisabled = ref(false)

export function syncTooltipFromState(state: { tooltipDisabled?: boolean }) {
  tooltipDisabled.value = state.tooltipDisabled ?? false
}
