export function trackVscodeTheme() {
  window.addEventListener('message', event => {
    const obj = JSON.parse(event.data) as {
      builtin?: boolean
      command?: '__updateBodyClass'
      htmlStyle: string
      bodyClass: string
    }
    console.log(obj)
    if (obj.builtin) {
      switch (obj.command) {
        case '__updateBodyClass':
          document.documentElement.setAttribute('style', obj.htmlStyle)
          document.body.setAttribute('class', obj.bodyClass)
          break
      }
    }
  })
  forwardKeys()
  window.parent.postMessage(
    JSON.stringify({
      command: '__init',
      builtin: true
    }),
    '*'
  )
}

function forwardKeys() {
  function handleInnerKeydown(e: KeyboardEvent) {
    const hasMeta = e.ctrlKey || e.metaKey
    const code = e.keyCode
    if ((hasMeta && code === 86) || (e.shiftKey && code === 45)) {
      // Ctrl+V or Shift+Insert
      document.execCommand('paste')
    } else if (hasMeta && code === 67) {
      // Ctrl+C
      document.execCommand('copy')
    } else if (hasMeta && code === 88) {
      // Ctrl+X
      document.execCommand('cut')
    } else if (hasMeta && code === 65) {
      // Ctrl+A
      document.execCommand('selectAll')
    } else if (hasMeta && code === 90) {
      // Ctrl+Z
      document.execCommand('undo')
    } else if (hasMeta && e.key === 'w') {
      window.parent.postMessage(
        JSON.stringify({
          command: '__keyDown',
          data: {
            key: e.key,
            code: e.code,
            altKey: e.altKey,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            metaKey: e.metaKey,
            repeat: e.repeat
          },
          builtin: true
        }),
        '*'
      )
    } else {
      return
    }
    e.preventDefault()
  }
  window.addEventListener('keydown', handleInnerKeydown)
}
