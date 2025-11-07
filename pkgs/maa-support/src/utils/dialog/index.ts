import * as macImpl from './mac'

export async function showFolderDialog(prompt: string) {
  switch (process.platform) {
    case 'darwin':
      return await macImpl.showFolderDialog(prompt)
    default:
      return null
  }
}

export async function showOpenFileDialog(prompt: string) {
  switch (process.platform) {
    case 'darwin':
      return await macImpl.showOpenFileDialog(prompt)
    default:
      return null
  }
}

export async function showSaveFileDialog(prompt: string, filename: string) {
  switch (process.platform) {
    case 'darwin':
      return await macImpl.showSaveFileDialog(prompt, filename)
    default:
      return null
  }
}
