import EventEmitter from 'events'

export class BaseServiceBase {
  async init() {}

  listen() {}
}

export class BaseService<Events extends Record<string, unknown[]> = {}> extends BaseServiceBase {
  emitter = new EventEmitter<Events>()
}
