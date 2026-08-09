import type { TestCases } from '../types/config'

export type ResourcePlan = {
  resourcePaths: readonly string[]
}

export function compareTestCases(left: TestCases, right: TestCases) {
  const controllerOrder = left.configs.controller.localeCompare(right.configs.controller)
  if (controllerOrder !== 0) {
    return controllerOrder
  }
  return left.configs.resource.localeCompare(right.configs.resource)
}

export function groupResourcePlans<T extends ResourcePlan>(plans: readonly T[]) {
  const groups = new Map<string, T[]>()
  for (const plan of plans) {
    const key = JSON.stringify(plan.resourcePaths)
    const group = groups.get(key)
    if (group) {
      group.push(plan)
    } else {
      groups.set(key, [plan])
    }
  }
  return [...groups.values()]
}
