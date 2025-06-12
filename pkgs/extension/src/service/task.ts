import { BaseService } from './context'
import { TaskLayer } from './pipeline/task'

export class TaskService extends BaseService {
  layers: TaskLayer[] = []

  async init() {}
}
