import vscode from 'vscode'

export const vscfs = {
  ...vscode.workspace.fs,

  exists(uri: vscode.Uri) {
    return vscode.workspace.fs.stat(uri).then(
      () => true,
      () => false
    )
  }
}
