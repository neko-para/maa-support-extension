import { Patch, produceWithPatches } from 'immer'
import * as vscode from 'vscode'

import { CropHostState, EvalTaskConfig } from '@mse/types'

import { BaseService, context } from './context'

export type State = {
  activeInterface?: string

  uploadDir?: string
  cropSettings?: CropHostState

  breakTasks?: string[]

  evalTaskConfig?: EvalTaskConfig
}

const stateKey = 'stateService:state'

export class StateService extends BaseService {
  state: State = {}

  stateChanged: vscode.EventEmitter<Patch[]> = new vscode.EventEmitter()
  get onStateChanged() {
    return this.stateChanged.event
  }

  constructor() {
    super()
    console.log('construct StateService')

    this.state = (context.workspaceState.get(stateKey) as State | undefined) ?? {}

    this.defer = this.stateChanged
  }

  async init() {
    console.log('init StateService')
  }

  reduce(change: (draft: State) => void) {
    const [newState, forwardPatches] = produceWithPatches(this.state, change)
    this.state = newState
    context.workspaceState.update(stateKey, this.state)

    this.stateChanged.fire(forwardPatches)
  }
}
