import type { AgentService } from './agent'
import type { CommandService } from './command'
import type { DebugService } from './debug'
import type { DiagnosticService } from './diagnostic'
import type { InterfaceService } from './interface'
import type { LaunchService } from './launch'
import type { NativeService } from './native'
import type { RootService } from './root'
import type { ServerService } from './server'
import type { ShortcutService } from './shortcut'
import type { StateService } from './state'
import type { StatusBarService } from './statusBar'

export type ServiceRegistry = {
  stateService: StateService
  nativeService: NativeService
  serverService: ServerService
  shortcutService: ShortcutService
  rootService: RootService
  interfaceService: InterfaceService
  launchService: LaunchService
  debugService: DebugService
  commandService: CommandService
  diagnosticService: DiagnosticService
  statusBarService: StatusBarService
  agentService: AgentService
}

export let stateService: StateService
export let nativeService: NativeService
export let serverService: ServerService
export let shortcutService: ShortcutService
export let rootService: RootService
export let interfaceService: InterfaceService
export let launchService: LaunchService
export let debugService: DebugService
export let commandService: CommandService
export let diagnosticService: DiagnosticService
export let statusBarService: StatusBarService
export let agentService: AgentService

export function registerServices(services: ServiceRegistry) {
  stateService = services.stateService
  nativeService = services.nativeService
  serverService = services.serverService
  shortcutService = services.shortcutService
  rootService = services.rootService
  interfaceService = services.interfaceService
  launchService = services.launchService
  debugService = services.debugService
  commandService = services.commandService
  diagnosticService = services.diagnosticService
  statusBarService = services.statusBarService
  agentService = services.agentService
}
