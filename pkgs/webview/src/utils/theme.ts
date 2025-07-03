import { type GlobalTheme, type GlobalThemeOverrides, darkTheme, lightTheme } from 'naive-ui'
import { onMounted, onUnmounted, ref } from 'vue'

export function useTheme(type: 'view' | 'panel') {
  const loaded = ref<boolean>(false)

  const theme = ref<GlobalTheme>(lightTheme)
  const themeOverride = ref<GlobalThemeOverrides>({})

  let updateThemeTimer: NodeJS.Timeout | undefined

  function updateTheme() {
    if (updateThemeTimer) {
      clearTimeout(updateThemeTimer)
    }
    updateThemeTimer = setTimeout(updateThemeImpl, 500)
  }

  function updateThemeImpl() {
    updateThemeTimer = undefined

    const styleMap = document.documentElement.computedStyleMap()
    const getVar = (key: string) => {
      return styleMap.get(key)?.toString()
    }

    const panelBgColor = getVar('--vscode-panel-background')
    const viewBgColor = getVar('--vscode-sideBar-background')

    themeOverride.value = {
      common: {
        fontFamily: getVar('--vscode-font-family'),
        fontFamilyMono: getVar('--vscode-editor-font-family'),
        borderColor: getVar('--vscode-editorWidget-border'),
        borderRadius: '0',
        cardColor: 'transparent',
        inputColor: 'transparent',
        inputColorDisabled: 'transparent',
        popoverColor: type === 'view' ? viewBgColor : panelBgColor,
        hoverColor: getVar('--vscode-toolbar-hoverBackground')
      },
      Card: {
        borderColor: getVar('--vscode-editorWidget-border')
      },
      Select: {
        peers: {
          InternalSelection: {
            border: `${getVar('--vscode-editorWidget-border')} solid 1px`,
            borderRadius: '0'
          }
        }
      },
      DynamicTags: {
        peers: {
          Tag: {
            color: 'red'
          }
        }
      }
    }

    const isLight =
      document.body.className.indexOf('vscode-light') !== -1 ||
      document.body.className.indexOf('vscode-high-contrast') !== -1
    const isDark = document.body.className.indexOf('vscode-dark') !== -1

    theme.value = isLight ? lightTheme : darkTheme
    loaded.value = isLight || isDark
  }

  const htmlObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'style') {
        updateTheme()
      }
    }
  })
  const bodyObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class') {
        updateTheme()
      }
    }
  })

  onMounted(() => {
    htmlObserver.observe(document.documentElement, { attributes: true })
    bodyObserver.observe(document.body, { attributes: true })
    updateThemeImpl()
  })

  onUnmounted(() => {
    htmlObserver.disconnect()
    bodyObserver.disconnect()

    if (updateThemeTimer) {
      clearTimeout(updateThemeTimer)
    }
  })

  return {
    loaded,
    theme,
    themeOverride
  }
}
