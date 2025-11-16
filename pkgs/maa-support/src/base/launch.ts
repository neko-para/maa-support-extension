import { InterfaceRuntime } from '@maaxyz/maa-support-types'
import { ChildProcess, spawn } from 'child_process'
import * as fs from 'fs/promises'
import * as iconv from 'iconv-lite'
import * as path from 'path'

import { t } from '../locale'
import { handle, pushEvent } from '../server'
import { BaseService } from './base'

export type LaunchInstance = {
  runtime: InterfaceRuntime
  stopped: boolean

  tasker: maa.Tasker
  resource: maa.Resource
  controller: maa.Controller
  client?: maa.Client
  agent?: ChildProcess
}

export class LaunchService extends BaseService {
  launchs: Map<string, LaunchInstance>

  constructor() {
    super()

    this.launchs = new Map()
  }

  listen() {
    handle('/launch/create', async req => {
      const controller = await this.buildController(req.runtime.controller_param)
      if (!controller) {
        return {
          succ: false,
          error: t('maa.debug.init-controller-failed')
        }
      }

      const [resource, client, agent] = await this.buildResource(req.runtime)
      if (!resource) {
        controller.destroy()
        return {
          succ: false,
          error: t('maa.debug.init-resource-failed')
        }
      }

      const tasker = new maa.Tasker()

      tasker.add_sink((_, msg) => {
        console.log(`${JSON.stringify(msg)}`)
      })

      tasker.controller = controller
      tasker.resource = resource

      if (!tasker.inited) {
        tasker.destroy()
        resource.destroy()
        client?.destroy()
        agent?.kill()

        return {
          succ: false,
          error: t('maa.debug.init-instance-failed')
        }
      }

      // TODO: register sink 接口被移除了

      this.launchs.set(req.pageId, {
        runtime: req.runtime,
        stopped: false,

        tasker,
        controller,
        resource,
        client,
        agent
      })

      return {
        succ: true
      }
    })

    handle('/launch/start', async req => {
      const launch = this.launchs.get(req.pageId)
      if (!launch) {
        return {}
      }

      await this.startLaunch(req.pageId, launch)
      return {}
    })

    handle('/launch/stop', async req => {
      const launch = this.launchs.get(req.pageId)
      if (!launch) {
        return
      }
      this.launchs.delete(req.pageId)
      launch.stopped = true
      await launch?.tasker.post_stop().wait()
      launch?.tasker.destroy()
      launch?.controller.destroy()
      launch?.resource.destroy()
      launch?.agent?.kill()
    })

    handle('/launch/recoDetail', async req => {
      const launch = this.launchs.get(req.pageId)
      if (!launch) {
        return { detail: null }
      }
      const detail = launch.tasker.recognition_detail(`${req.recoId}` as maa.RecoId)
      if (detail) {
        return {
          detail: {
            name: detail.name,
            algorithm: detail.algorithm,
            hit: detail.hit,
            box: detail.box,
            detail: detail.detail,
            raw: Buffer.from(detail.raw).toString('base64'),
            draws: detail.draws.map(data => Buffer.from(data).toString('base64'))
          }
        }
      } else {
        return { detail: null }
      }
    })

    handle('/launch/actDetail', async req => {
      const launch = this.launchs.get(req.pageId)
      if (!launch) {
        return { detail: null }
      }
      const detail = launch.tasker.action_detail(`${req.actId}` as maa.RecoId) // TODO: act id
      if (detail) {
        return {
          detail: {
            name: detail.name,
            action: detail.action,
            box: detail.box,
            success: detail.success,
            detail: detail.detail
          }
        }
      } else {
        return { detail: null }
      }
    })

    handle('/page/close', async req => {
      const launch = this.launchs.get(req.pageId)
      if (!launch) {
        return
      }
      this.launchs.delete(req.pageId)
      launch.stopped = true
      await launch?.tasker.post_stop().wait()
      launch?.tasker.destroy()
      launch?.controller.destroy()
      launch?.resource.destroy()
      launch?.agent?.kill()
    })
  }

  async buildController(runtime: InterfaceRuntime['controller_param']) {
    let controller: maa.Controller | undefined

    if (runtime.ctype === 'adb') {
      controller = new maa.AdbController(
        runtime.adb_path,
        runtime.address,
        runtime.screencap,
        runtime.input,
        runtime.config
      )
    } else if (runtime.ctype === 'win32') {
      controller = new maa.Win32Controller(
        runtime.hwnd,
        runtime.screencap,
        runtime.mouse,
        runtime.keyboard
      )
    } else if (runtime.ctype === 'vscFixed') {
      const image = (await fs.readFile(runtime.image)).buffer as ArrayBuffer
      controller = new maa.CustomController({
        connect() {
          return true
        },
        request_uuid() {
          return '0'
        },
        screencap() {
          return image
        }
      })
    } else {
      return null
    }

    if (runtime.display_short_side) {
      controller.screenshot_target_short_side = runtime.display_short_side
    } else if (runtime.display_long_side) {
      controller.screenshot_target_long_side = runtime.display_long_side
    } else if (runtime.display_raw) {
      controller.screenshot_use_raw_size = true
    }

    controller.add_sink((_, msg) => {
      console.log(`${JSON.stringify(msg)}`)
    })

    if (await controller.post_connection().wait().succeeded) {
      return controller
    } else {
      controller.destroy()
      return null
    }
  }

  async buildResource(
    runtime: InterfaceRuntime
  ): Promise<[maa.Resource | null, maa.Client | undefined, ChildProcess | undefined]> {
    const resource = new maa.Resource()

    resource.add_sink((_, msg) => {
      console.log(`${JSON.stringify(msg)}`)
    })

    for (const path of runtime.resource_path) {
      if (!(await resource.post_bundle(path).wait().succeeded)) {
        resource.destroy()
        return [null, undefined, undefined]
      }
    }

    let client: maa.Client | undefined = undefined
    let agent: ChildProcess | undefined = undefined
    if (runtime.agent) {
      client = new maa.Client(runtime.agent.identifier)
      const identifier = client.identifier ?? 'vsc-no-identifier'

      console.log(`AgentClient listening ${identifier}`)

      if (runtime.agent.child_exec) {
        agent = spawn(
          runtime.agent.child_exec,
          (runtime.agent.child_args ?? []).concat([identifier]),
          {
            cwd: runtime.root,
            shell: true,
            env: {
              VSCODE_MAAFW_AGENT: '1',
              VSCODE_MAAFW_AGENT_ROOT: runtime.root,
              VSCODE_MAAFW_AGENT_RESOURCE: runtime.resource_path.join(path.delimiter)
            },
            stdio: 'pipe'
          }
        )
        let encoding = 'utf8'
        if (process.platform === 'win32') {
          encoding = 'gbk'
        }
        agent.stdout?.on('data', (data: Buffer) => {
          console.log('agent stdout', iconv.decode(data, encoding))
        })
        agent.stderr?.on('data', (data: Buffer) => {
          console.log('agent stderr', iconv.decode(data, encoding))
        })
      }
      client.bind_resource(resource)
      console.log(`AgentClient start connecting ${identifier}`)
      if (
        !(await client
          .connect()
          .then(
            () => true,
            () => false
          )
          .then(res => {
            console.log(`AgentClient start connect ${res ? 'succeed' : 'failed'}`)
            return res
          }))
      ) {
        resource.destroy()
        agent?.kill()
        return [null, undefined, undefined]
      }
    }

    return [resource, client, agent]
  }

  async startLaunch(id: string, launch: LaunchInstance) {
    launch.tasker.add_sink((_, msg) => {
      pushEvent('launch/message', {
        id,
        msg
      })
    })
    launch.tasker.add_context_sink((_, msg) => {
      pushEvent('launch/message', {
        id,
        msg
      })
    })

    for (const task of launch.runtime.task) {
      if (launch.stopped) {
        break
      }
      await launch.tasker
        .post_task(task.entry, task.pipeline_override as Record<string, unknown>[])
        .wait()
    }
  }
}
