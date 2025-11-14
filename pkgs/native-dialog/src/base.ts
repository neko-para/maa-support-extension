export type FileDialogOption = {
  title?: string
  defaultFolder?: string
  defaultFile?: string
  multi?: boolean
}

export class BaseImpl {
  async openFile(option: FileDialogOption): Promise<string[] | null> {
    return null
  }

  async saveFile(option: FileDialogOption): Promise<string | null> {
    return null
  }

  async openFolder(option: FileDialogOption): Promise<string[] | null> {
    return null
  }

  async openUrl(url: string): Promise<void> {}
}
