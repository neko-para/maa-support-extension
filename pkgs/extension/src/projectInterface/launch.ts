import { LaunchViewFromHost } from '@mse/types'

import { Maa } from '../maa'
import { useLaunchView } from '../web'
import { TaskerInstance } from './launcher'

function toPngDataUrl(buffer: ArrayBuffer) {
  return 'data:image/png;base64,' + Buffer.from(buffer).toString('base64')
}

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
          await this.stop(false)
          break
      }
    }
  }

  async stop(send: boolean) {
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
    await this.stop(true)
    this.pushNotify = async () => {}
    this.instance.tasker.destroy()
    this.instance.resource.destroy()
  }
}
