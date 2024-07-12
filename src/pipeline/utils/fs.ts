import * as vscode from 'vscode'

export function currentWorkspace() {
  return vscode.workspace.workspaceFolders?.[0]?.uri ?? null
}

export type ResourceRoot = [uri: vscode.Uri, suffix: string]

export async function locateResourceRoot() {
  const root = currentWorkspace()
  if (!root) {
    return []
  }

  const result: ResourceRoot[] = []

  const travel = async (current: vscode.Uri) => {
    const childs = await vscode.workspace.fs.readDirectory(current)
    for (const [name, type] of childs) {
      if (['.git', 'node_modules'].includes(name)) {
        continue
      }
      if (name === 'pipeline' && type === vscode.FileType.Directory) {
        result.push([current, current.fsPath.replace(root.fsPath, '')])
      }
      if (type === vscode.FileType.Directory) {
        await travel(vscode.Uri.joinPath(current, name))
      }
    }
  }

  await travel(root)

  return result
}
