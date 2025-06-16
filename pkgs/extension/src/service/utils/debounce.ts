export function debounce(action: () => void, timeout = 500): () => void {
  let timer: NodeJS.Timeout | null = null
  return () => {
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      timer = null
      action()
    }, timeout)
  }
}
