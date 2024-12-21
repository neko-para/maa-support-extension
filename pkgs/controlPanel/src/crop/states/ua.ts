interface NavigatorWithAgent extends Navigator {
  userAgentData?: {
    platform?: string
  }
}

export const isMac =
  ((navigator as NavigatorWithAgent)?.userAgentData?.platform?.toLowerCase() ?? '').indexOf(
    'mac'
  ) !== -1

export function checkCtrl(event: PointerEvent | KeyboardEvent) {
  return isMac ? event.metaKey : event.ctrlKey
}
