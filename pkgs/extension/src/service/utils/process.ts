import { ChildProcess, spawn } from 'child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as vscode from 'vscode'

import { logger } from '../../utils/logger'
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
    const script = `$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$cmd = Join-Path ([Environment]::SystemDirectory) 'cmd.exe'
Start-Process -FilePath $cmd -ArgumentList "${keepAlive ? '/K' : '/C'}","set ELECTRON_RUN_AS_NODE=\`"1\`" & \`"${process.argv[0]}\`" \`"${this.script}\`" \`"${arg}\`"" -Wait -Verb RunAs`
    await fs.writeFile(
      this.ps1ScriptPath,
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(script, 'utf8')])
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
      await this.setupPs1(arg)
      if (!this.ps1ScriptPath) {
        return false
      }
      proc = spawn(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', this.ps1ScriptPath],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      )
    } else {
      proc = spawn(process.argv[0], [this.script, arg], { stdio: ['ignore', 'pipe', 'pipe'] })
    }

    for (const stream of [proc.stdout, proc.stderr]) {
      stream?.setEncoding('utf8')
      stream?.on('data', (data: string) => {
        logger.info(data.trimEnd())
      })
    }

    const [promise, resolve] = makePromise<boolean>()

    proc.on('spawn', () => {
      if (!this.proc) {
        this.proc = proc
        resolve(true)
      } else {
        proc.kill()
        resolve(false)
      }
    })
    proc.on('error', () => {
      resolve(false)
    })
    proc.on('close', () => {
      if (proc === this.proc) {
        this.proc = undefined
      }
    })

    return promise
  }

  kill() {
    this.proc?.kill()
    this.proc = undefined
  }
}
