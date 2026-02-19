import { ChildProcess, spawn } from 'child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as vscode from 'vscode'

import { logger } from '@mse/utils'

import { makePromise } from './promise'

export class ProcessManager {
  script: string
  admin: boolean
  ps1ScriptPath?: string

  proc?: ChildProcess

  clean?: () => void

  constructor(script: string, admin: boolean) {
    this.script = script
    this.admin = admin && process.platform === 'win32'
  }

  async setupPs1(arg: string) {
    const tempFolder = await fs.mkdtemp(path.join(os.tmpdir(), 'mse-ps1-'))
    this.ps1ScriptPath = path.join(tempFolder, 'uac.ps1')
    const keepAlive = vscode.workspace.getConfiguration('maa').get('win32ProcKeep') as boolean
    await fs.writeFile(
      this.ps1ScriptPath,
      `Start-Process -FilePath cmd -ArgumentList "${keepAlive ? '/K' : '/C'}","set ELECTRON_RUN_AS_NODE=\`"1\`" & \`"${process.argv[0]}\`" \`"${this.script}\`" \`"${arg}\`"" -Wait -Verb RunAs`
    )
    this.clean = () => {
      fs.rm(tempFolder, { recursive: true })
    }
  }

  async ensure(arg: string) {
    if (this.proc) {
      return true
    }

    let proc: ChildProcess

    if (this.admin) {
      logger.info('before setup sp1')
      await this.setupPs1(arg)
      logger.info('after setup sp1')
      if (!this.ps1ScriptPath) {
        return false
      }
      logger.info('before spawn')
      proc = spawn('powershell.exe', [this.ps1ScriptPath], { stdio: ['ignore', 'pipe', 'pipe'] })
      logger.info('after spawn')

      proc.stdout?.on('data', (data: Buffer) => {
        logger.info(data.toString().trimEnd())
      })
      proc.stderr?.on('data', (data: Buffer) => {
        logger.info(data.toString().trimEnd())
      })
    } else {
      proc = spawn(process.argv[0], [this.script, arg], { stdio: ['ignore', 'pipe', 'pipe'] })

      proc.stdout?.on('data', (data: Buffer) => {
        logger.info(data.toString().trimEnd())
      })
      proc.stderr?.on('data', (data: Buffer) => {
        logger.info(data.toString().trimEnd())
      })
    }

    const [promise, resolve] = makePromise<boolean>()

    proc.on('spawn', () => {
      logger.info('on spawn')
      if (!this.proc) {
        this.proc = proc
        resolve(true)
      } else {
        proc.kill()
        resolve(false)
      }
    })
    proc.on('error', () => {
      logger.info('on error')
      resolve(false)
    })
    proc.on('close', () => {
      logger.info('on close')
      if (proc === this.proc) {
        this.proc = undefined
      }
    })
    proc.on('exit', () => {
      logger.info('on exit')
    })
    proc.on('disconnect', () => {
      logger.info('on disconnect')
    })

    return promise
  }

  kill() {
    this.proc?.kill()
    this.proc = undefined
  }
}
