import { existsSync, statSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import readline from 'node:readline'

import { MaaEvalContext, MaaEvalDelegate } from '../eval'
import type { MaaTask, MaaTaskExpr } from '../types'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function query() {
  return new Promise<string>(resolve => {
    rl.question('> ', res => {
      resolve(res)
    })
  })
}

class MaaEvalDelegateImpl extends MaaEvalDelegate {
  rawTasks: Record<string, MaaTask> = {}

  async query(task: string): Promise<[task: MaaTask, anchor: string][]> {
    if (task in this.rawTasks) {
      return [[this.rawTasks[task], '']]
    } else {
      return []
    }
  }

  async load(file: string) {
    if (!existsSync(file)) {
      return
    }
    const st = statSync(file)
    if (st.isDirectory()) {
      for (const sub of await readdir(file)) {
        await this.load(path.join(file, sub))
      }
    } else if (st.isFile()) {
      if (file.endsWith('.json')) {
        const content = await readFile(file, 'utf8')
        const tasks: Record<string, MaaTask> = JSON.parse(content)
        for (const [name, task] of Object.entries(tasks)) {
          this.rawTasks[name] = task
        }
      }
    }
  }
}

async function main() {
  let delegate = new MaaEvalDelegateImpl()
  let context = new MaaEvalContext(delegate)

  let running = true
  while (running) {
    const act = await query()
    const match = /^(task|expr|list|load|reset|exit|quit) (.+)$/.exec(act.trim())
    if (!match) {
      continue
    }
    switch (match[1]) {
      case 'task':
        console.log(JSON.stringify((await context.evalTask(match[2]))?.task ?? null, null, 4))
        break
      case 'expr': {
        const match2 = /^(.+?) (.+)$/.exec(match[2])
        if (!match2) {
          break
        }
        console.log(
          JSON.stringify(await context.evalExpr(match2[2] as MaaTaskExpr, match2[1], true))
        )
        break
      }
      case 'list':
        console.log(JSON.stringify(Object.keys(delegate.rawTasks), null, 4))
        break
      case 'load':
        await delegate.load(match[2])
        context.cleanCache()
        break
      case 'reset':
        delegate.rawTasks = {}
        context.cleanCache()
        break
      case 'exit':
      case 'quit':
        running = false
        break
    }
  }
}

main()
