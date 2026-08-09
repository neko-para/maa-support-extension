export interface MaaEvalMissingIssues {
  missingTasks: string[]
  missingBaseTasks: string[]
}

export function getBlockingMissingTasks(issues: MaaEvalMissingIssues) {
  const missingBaseTasks = new Set(issues.missingBaseTasks)
  return issues.missingTasks.filter(task => !missingBaseTasks.has(task))
}

export class MaaEvalMissingIssueCollector {
  private readonly missingTasks = new Set<string>()
  private readonly missingBaseTasks = new Set<string>()

  reset() {
    this.missingTasks.clear()
    this.missingBaseTasks.clear()
  }

  cannotFindTask(task: string, prefix: string[]) {
    this.missingTasks.add([...prefix, task].join('@'))
  }

  warnCannotFindBaseTask(task: string) {
    this.missingBaseTasks.add(task)
  }

  take(): MaaEvalMissingIssues {
    const issues = {
      missingTasks: [...this.missingTasks],
      missingBaseTasks: [...this.missingBaseTasks]
    }
    this.reset()
    return issues
  }
}
