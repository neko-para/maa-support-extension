import {
  computed,
  extensionContext,
  ref,
  useVscodeContext,
  useWorkspaceFolders
} from 'reactive-vscode'
import vscode from 'vscode'

import { vscfs } from '@mse/utils'

import { useControlPanel } from '../extension'

export type ResourceRoot = {
  dirUri: vscode.Uri
  dirRelative: string
  interfaceUri: vscode.Uri
  interfaceRelative: string
  configUri: vscode.Uri
}

async function locateInterfaces() {
  const roots = useWorkspaceFolders()

  if (!roots.value || roots.value.length === 0) {
    return []
  }

  const root = roots.value[0].uri

  const result: ResourceRoot[] = []

  const travel = async (current: vscode.Uri) => {
    const childs = await vscfs.readDirectory(current)
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

export function useInterface() {
  const { hostContext } = useControlPanel()

  async function scanInterface() {
    hostContext.value.refreshingInterface = true
    const interfaces = await locateInterfaces()
    hostContext.value.interfaces = await Promise.all(
      interfaces.map(async x => ({
        path: x.interfaceRelative,
        content: JSON.parse((await vscfs.readFile(x.interfaceUri)).toString())
      }))
    )
    await new Promise(resolve => setTimeout(resolve, 1000))
    hostContext.value.refreshingInterface = false
  }

  return {
    scanInterface
  }
}
