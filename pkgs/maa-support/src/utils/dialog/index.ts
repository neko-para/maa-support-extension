import * as macImpl from './mac'
import * as winImpl from './win'

export async function showFolderDialog(prompt: string) {
  switch (process.platform) {
    case 'darwin':
      return await macImpl.showFolderDialog(prompt)
    case 'win32':
      return await winImpl.showFolderDialog(prompt)
    default:
      return null
  }
}

export async function showOpenFileDialog(prompt: string) {
  switch (process.platform) {
    case 'darwin':
      return await macImpl.showOpenFileDialog(prompt)
    case 'win32':
      return await winImpl.showOpenFileDialog(prompt)
    default:
      return null
  }
}

export async function showSaveFileDialog(prompt: string, filename: string) {
  switch (process.platform) {
    case 'darwin':
      return await macImpl.showSaveFileDialog(prompt, filename)
    case 'win32':
      return await winImpl.showSaveFileDialog(prompt, filename)
    default:
      return null
  }
}

showFolderDialog('123123').then(res => {
  console.log(res)
})
