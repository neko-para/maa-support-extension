import { type Express } from 'express'

export class BaseService {
  async init() {}

  async listen(app: Express) {}
}
