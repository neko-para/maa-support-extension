import * as vscode from 'vscode'

export function currentWorkspace() {
  return vscode.workspace.workspaceFolders?.[0]?.uri ?? null
}

export async function exists(uri: vscode.Uri) {
  try {
    return await vscode.workspace.fs.stat(uri)
  } catch (_) {
    return null
  }
}

export type ResourceRoot = {
  dirUri: vscode.Uri
  dirRelative: string
  interfaceUri: vscode.Uri
  interfaceRelative: string
  configUri: vscode.Uri
}

export async function locateResourceRoot() {
  const root = currentWorkspace()
  if (!root) {
    return []
  }

  const result: ResourceRoot[] = []

  const travel = async (current: vscode.Uri) => {
    const childs = await vscode.workspace.fs.readDirectory(current)
    for (const [name, type] of childs) {
      if (['node_modules'].includes(name) || name.startsWith('.')) {
        continue
      }
      if (name === 'interface.json' && type === vscode.FileType.File) {
        result.push({
          dirUri: current,
          dirRelative: current.fsPath.replace(root.fsPath, ''),
          interfaceUri: vscode.Uri.joinPath(current, 'interface.json'),
          interfaceRelative: vscode.Uri.joinPath(current, 'interface.json').fsPath.replace(
            root.fsPath,
            ''
          ),
          configUri: vscode.Uri.joinPath(current, 'config/maa_pi_config.json')
        })
      }
      if (type === vscode.FileType.Directory) {
        await travel(vscode.Uri.joinPath(current, name))
      }
    }
  }

  await travel(root)

  return result
}
