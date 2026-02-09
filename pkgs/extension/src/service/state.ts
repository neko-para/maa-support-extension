import { CropSettings, EvalTaskConfig } from '@mse/types'

import { BaseService, context } from './context'

export type State = {
  admin?: boolean

  activeInterface?: string

  uploadDir?: string
  cropSettings?: CropSettings

  breakTasks?: string[]

  evalTaskConfig?: EvalTaskConfig
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
