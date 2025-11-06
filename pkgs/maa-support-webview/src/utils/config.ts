export let isVscode: boolean = false
export let vscodeViewType: 'view' | 'panel' = 'panel'

export let viewRole: 'control' | 'launch' | 'crop' = 'control'

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
}
