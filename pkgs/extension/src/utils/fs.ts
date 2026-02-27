import { existsSync } from 'node:fs'
import * as path from 'node:path'
import * as vscode from 'vscode'

export function currentWorkspace() {
  return vscode.workspace.workspaceFolders?.[0]?.uri ?? null
}

export type ResourceRoot = {
  workspace: vscode.Uri
  dirUri: vscode.Uri
  dirRelative: string
  interfaceUri: vscode.Uri
  interfaceRelative: string
  configUri: vscode.Uri
}

async function locateResourceRootImpl(root: vscode.Uri) {
  const result: ResourceRoot[] = []

  const travel = async (current: vscode.Uri) => {
    const childs = await vscode.workspace.fs.readDirectory(current)
    for (const [name, type] of childs) {
      if (['node_modules'].includes(name) || name.startsWith('.')) {
        continue
      }
      if (name === 'interface.json' && type === vscode.FileType.File) {
        result.push({
          workspace: root,
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

export async function locateResourceRoot() {
  const result: ResourceRoot[] = []

  for (const workspace of vscode.workspace.workspaceFolders ?? []) {
    result.push(...(await locateResourceRootImpl(workspace.uri)))
  }

  return result
}

export let isMaaAssistantArknights = false
export let pipelineSuffix = 'pipeline'
export let imageSuffix = 'image'
export function checkMaaAssistantArknights() {
  // TODO: 根据interface来判断，但是得到处传播下，而且得支持修改
  const root = currentWorkspace()
  // 很蠢，但是能用
  if (root && existsSync(path.join(root.fsPath, 'src', 'MaaCore'))) {
    isMaaAssistantArknights = true
    pipelineSuffix = 'tasks'
    imageSuffix = 'template'
  }
}
