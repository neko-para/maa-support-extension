import { type GlobalTheme, type GlobalThemeOverrides, darkTheme, lightTheme } from 'naive-ui'
import { onMounted, onUnmounted, ref } from 'vue'

export function useTheme() {
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

    console.log(getVar('--vscode-editorWidget-border'))

    themeOverride.value = {
      common: {
        fontFamily: getVar('--vscode-font-family'),
        fontFamilyMono: getVar('--vscode-editor-font-family'),
        borderColor: getVar('--vscode-editorWidget-border'),
        borderRadius: '0',
        cardColor: 'transparent',
        inputColor: 'transparent'
      },
      Card: {
        borderColor: getVar('--vscode-editorWidget-border')
      }
    }

    if (document.body.className === 'vscode-dark') {
      theme.value = darkTheme
    } else {
      theme.value = lightTheme
    }
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
    updateTheme()
  })

  onUnmounted(() => {
    htmlObserver.disconnect()
    bodyObserver.disconnect()

    if (updateThemeTimer) {
      clearTimeout(updateThemeTimer)
    }
  })

  return {
    theme,
    themeOverride
  }
}
