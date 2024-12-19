import { LaunchViewFromHost } from '@mse/types'

import { useLaunchView } from '../web'
import { TaskerInstance } from './launcher'

export class ProjectInterfaceLaunchInstance {
  instance: TaskerInstance
  stopped: boolean = false

  post: (data: LaunchViewFromHost) => void = () => {}

  constructor(inst: TaskerInstance) {
    this.instance = inst

    const oldNotify = inst.tasker.notify
    inst.tasker.notify = async (msg, detail) => {
      await oldNotify(msg, detail)
      await this.pushNotify(msg, detail)
    }
  }

  async setup() {
    const { onDidDispose, post, handler } = await useLaunchView()
    this.post = post
    onDidDispose.push(() => {
      this.dispose()
    })
    handler.value = async data => {
      switch (data.cmd) {
        case 'queryReco':
          break
        case 'stopLaunch':
          await this.stop()
          break
      }
    }
  }

  async stop() {
    await this.instance.tasker.post_stop().wait()
    this.stopped = true
    this.post({
      cmd: 'stopped'
    })
  }

  async pushNotify(msg: string, details: string) {
    this.post({
      cmd: 'notify',
      msg,
      details
    })
  }

  async dispose() {
    await this.instance.tasker.post_stop().wait()
    this.pushNotify = async () => {}
    this.instance.tasker.destroy()
    this.instance.resource.destroy()
  }
}
