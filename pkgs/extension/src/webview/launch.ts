import { LaunchViewFromHost } from '@mse/types'

import { Maa } from '../maa'
import { TaskerInstance } from '../projectInterface/launcher'
import { useLaunchView } from '../web'
import { ProjectInterfaceCropInstance } from './crop'
import { toPngDataUrl } from './utils'

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
          {
            const detailInfo = this.instance.tasker.recognition_detail(data.reco as Maa.api.RecoId)
            if (!detailInfo) {
              return
            }
            detailInfo.detail = JSON.stringify(JSON.parse(detailInfo.detail), null, 4)
            post({
              cmd: 'showReco',
              raw: toPngDataUrl(detailInfo.raw),
              draws: detailInfo.draws.map(toPngDataUrl),
              info: detailInfo
            })
          }
          break
        case 'stopLaunch':
          await this.stop()
          break
        case 'showCrop':
          new ProjectInterfaceCropInstance().setup(data.image)
          break
      }
    }
  }

  async stop(send = true) {
    if (this.stopped) {
      return
    }
    await this.instance.tasker.post_stop().wait()
    this.stopped = true
    if (send) {
      this.post({
        cmd: 'stopped'
      })
    }
  }

  async pushNotify(msg: string, details: string) {
    this.post({
      cmd: 'notify',
      msg,
      details
    })
  }

  async dispose() {
    await this.stop()
    this.pushNotify = async () => {}
    this.instance.tasker.destroy()
    this.instance.resource.destroy()
  }
}