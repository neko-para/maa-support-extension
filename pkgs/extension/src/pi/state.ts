import { ref } from 'reactive-vscode'

import { useControlPanel } from '../extension'

export function useInterface() {
  const { hostContext } = useControlPanel()

  function scanInterface() {
    hostContext.value.interfaces = [...(hostContext.value.interfaces ?? []), '123']
  }

  return {
    scanInterface
  }
}
