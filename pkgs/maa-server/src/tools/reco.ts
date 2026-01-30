import { ipc } from '../apis'
import { sendLog } from '../server'
import { convertImage, setupFixedController } from './utils'

let prevTask: string | undefined = undefined

export async function performReco(
  imageBase64: string,
  resources: string[]
): Promise<string | null> {
  const image = convertImage(imageBase64)

  const ctrl = await setupFixedController(image)

  if (!ctrl) {
    sendLog('quick reco ctrl create failed')
    return null
  }

  const res = new maa.Resource()
  for (const resource of resources) {
    await res.post_bundle(resource).wait()
  }
  if (!res.loaded) {
    sendLog('quick reco res create failed')
    return null
  }

  const tasks = res.node_list
  if (!tasks) {
    sendLog('quick reco res no task')
    return null
  }

  tasks.sort()
  if (prevTask) {
    const prevIdx = tasks.findIndex(x => x === prevTask)
    if (prevIdx !== -1) {
      tasks.splice(prevIdx, 1)
      tasks.unshift(prevTask)
    }
  }
  const task = await ipc.quickPick(tasks)
  if (!task) {
    return null
  }

  prevTask = task

  const tasker = new maa.Tasker()
  tasker.controller = ctrl
  tasker.resource = res
  if (!tasker.inited) {
    sendLog('quick reco tasker create failed')
    return null
  }

  let result: string | null = null

  res.register_custom_action('@mse/action', async self => {
    sendLog('quick reco action called')
    const detail = await self.context.run_recognition(task, image)
    if (detail?.hit) {
      const presp = {
        ...detail
      } as Partial<typeof detail>
      delete presp.draws
      delete presp.raw
      result = JSON.stringify(presp)
    }
    return true
  })

  await tasker
    .post_task('@mse/action', {
      '@mse/action': {
        action: 'Custom',
        custom_action: '@mse/action'
      }
    })
    .wait()

  sendLog('quick reco destroy')

  tasker.destroy()
  res.destroy()
  ctrl.destroy()

  return result
}
