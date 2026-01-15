import EventEmitter from 'node:events'

export class Interface extends EventEmitter<{}> {
  constructor() {
    super()
  }
}
