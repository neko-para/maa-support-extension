import type { PageType } from '@maaxyz/maa-support-types'

export let isVscode: boolean = false
export let vscodeViewType: 'view' | 'panel' = 'panel'

export let viewRole: 'control' | PageType | null = null
export let viewId: string | null = null

export function setup() {
  const urlParams = new URLSearchParams(window.location.search)

  const type = urlParams.get('vsc_view_type')
  if (type === 'view' || type === 'panel') {
    isVscode = true
    vscodeViewType = type

    document.body.classList.add('vscode_mode')
  } else {
    isVscode = false
  }

  const role = urlParams.get('maa_role')
  if (role === 'control' || role === 'launch' || role === 'crop') {
    viewRole = role
  }

  if (viewRole === 'launch' || viewRole === 'crop') {
    const id = urlParams.get('maa_id')
    if (id) {
      viewId = id
    }
  }
}
