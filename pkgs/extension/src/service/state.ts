import { ResourceRoot } from '../fs'
import { BaseService, context } from './context'

export type State = {
  activeInterface?: string
}

const stateKey = 'stateService:state'

export class StateService extends BaseService {
  state: State = {}

  async init() {
    this.state = context.workspaceState.get(stateKey) as State
  }

  reduce(change: Partial<State>) {
    this.state = {
      ...this.state,
      ...change
    }
    context.workspaceState.update(stateKey, this.state)
  }
}
