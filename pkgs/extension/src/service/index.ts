import * as vscode from 'vscode'

import { init as initContext } from './context'
import { InterfaceService } from './interface'
import { RootService } from './root'
import { StateService } from './state'
import { TaskService } from './task'

export { context } from './context'

export let stateService: StateService
export let rootService: RootService
export let interfaceService: InterfaceService
export let taskService: TaskService

export async function init(ctx: vscode.ExtensionContext) {
  initContext(ctx)

  stateService = new StateService()
  await stateService.init()

  rootService = new RootService()
  await rootService.init()

  interfaceService = new InterfaceService()
  await interfaceService.init()

  taskService = new TaskService()
  await taskService.init()
}
