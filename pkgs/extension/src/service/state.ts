import { BaseService, context } from './context'

export type State = {
  activeInterface?: string

  uploadDir?: string
}

const stateKey = 'stateService:state'

export class StateService extends BaseService {
  state: State = {}

  constructor() {
    super()
    console.log('construct StateService')

    this.state = (context.workspaceState.get(stateKey) as State | undefined) ?? {}
  }

  async init() {
    console.log('init StateService')
  }

  reduce(change: Partial<State>) {
    this.state = {
      ...this.state,
      ...change
    }
    context.workspaceState.update(stateKey, this.state)
  }
}
