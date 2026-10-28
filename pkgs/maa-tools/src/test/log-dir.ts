import { randomUUID } from 'node:crypto'
import { unlinkSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

/** 保留最近几轮已结束的识别日志；活动轮次不参与清理和计数。 */
export const KEEP_RUN_LOG_DIRS = 10

/** 测试日志默认放在 <cwd>/debug；maaLogDir 相对 cwd 解析。 */
export function testLogRoot(cfg: { cwd?: string; maaLogDir?: string }): string {
  const cwd = cfg.cwd ?? process.cwd()
  return cfg.maaLogDir ? path.resolve(cwd, cfg.maaLogDir) : path.resolve(cwd, 'debug')
}

const RUN_DIR_PATTERN = /^maa-tools-run-(\d+)$/
const ACTIVE_MARKER_PATTERN = /^\.maa-tools-run-(\d+)-(\d+)-[\da-f-]+\.active$/
const activeRuns = new Map<string, { marker: string; keep: number }>()

// 正常退出时同步释放。SIGKILL、原生崩溃等无法执行回调的退出，由后续运行回收。
process.once('exit', () => {
  for (const { marker } of activeRuns.values()) {
    try {
      unlinkSync(marker)
    } catch {
      // 退出期间不再抛错；遗留标记会按进程是否存活回收。
    }
  }
})

/** 从目录名列表算出下一轮的编号。 */
export function nextRunDirNumber(names: readonly string[]): number {
  let next = 1
  for (const name of names) {
    const matched = RUN_DIR_PATTERN.exec(name)
    if (matched) {
      next = Math.max(next, Number(matched[1]) + 1)
    }
  }
  return next
}

/** 只比较轮次目录名，列出编号最大的 keep 个之外的旧目录。 */
export function staleRunDirNames(names: readonly string[], keep = KEEP_RUN_LOG_DIRS): string[] {
  const runs: { name: string; number: number }[] = []
  for (const name of names) {
    const matched = RUN_DIR_PATTERN.exec(name)
    if (matched) {
      runs.push({ name, number: Number(matched[1]) })
    }
  }
  runs.sort((left, right) => left.number - right.number)
  return runs.slice(0, Math.max(0, runs.length - keep)).map(item => item.name)
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // 无权探测另一个用户的进程时，保守地保留它的日志。
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}

async function cleanFinishedRunDirs(logRoot: string, keep: number): Promise<void> {
  const entries = await fs.readdir(logRoot, { withFileTypes: true })
  const activeNumbers = new Set<number>()
  for (const entry of entries) {
    const matched = ACTIVE_MARKER_PATTERN.exec(entry.name)
    if (!matched || !entry.isFile()) {
      continue
    }
    const marker = path.join(logRoot, entry.name)
    const pid = Number(matched[2])
    const ownedHere = [...activeRuns.values()].some(run => run.marker === marker)
    if (pid === process.pid ? ownedHere : processIsAlive(pid)) {
      activeNumbers.add(Number(matched[1]))
    } else {
      // 每份标记都有唯一名字，不会误删另一轮刚创建的标记。
      await fs.rm(marker, { force: true })
    }
  }
  const finished = entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => {
      const matched = RUN_DIR_PATTERN.exec(name)
      return matched && !activeNumbers.has(Number(matched[1]))
    })
  for (const name of staleRunDirNames(finished, keep)) {
    // 名字已经通过严格匹配，只删除 logRoot 的直接子目录，不跟随符号链接。
    await fs.rm(path.join(logRoot, name), { recursive: true, force: true })
  }
}

/**
 * 建立活动轮次目录，清理已结束的旧轮次。编号通过 mkdir 原子竞争。
 * 活动标记先于目录创建，避免另一进程恰好在 mkdir 与写标记之间清理本轮。
 * 调用方必须等所有 worker 停止后，在 finally 调用 releaseRunLogDir。
 */
export async function createRunLogDir(logRoot: string, keep = KEEP_RUN_LOG_DIRS): Promise<string> {
  const root = path.resolve(logRoot)
  const keepCount = Number.isFinite(keep) ? Math.max(1, Math.floor(keep)) : KEEP_RUN_LOG_DIRS
  await fs.mkdir(root, { recursive: true })

  let number = nextRunDirNumber(await fs.readdir(root))
  while (true) {
    const runLogDir = path.join(root, `maa-tools-run-${number}`)
    const marker = path.join(root, `.maa-tools-run-${number}-${process.pid}-${randomUUID()}.active`)
    // 创建中也视为活动。Map 按标记区分同时竞争同一个编号的调用。
    activeRuns.set(marker, { marker, keep: keepCount })
    try {
      await fs.writeFile(marker, '', { flag: 'wx' })
      await fs.mkdir(runLogDir)
    } catch (error) {
      activeRuns.delete(marker)
      await fs.rm(marker, { force: true })
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        number += 1
        continue
      }
      throw error
    }
    activeRuns.delete(marker)
    activeRuns.set(runLogDir, { marker, keep: keepCount })
    try {
      await cleanFinishedRunDirs(root, keepCount)
      return runLogDir
    } catch (error) {
      await releaseRunLogDir(runLogDir)
      throw error
    }
  }
}

/** 幂等释放本进程的轮次保护，再按保留数量清理已结束的目录。 */
export async function releaseRunLogDir(runLogDir: string): Promise<void> {
  const dir = path.resolve(runLogDir)
  const run = activeRuns.get(dir)
  if (!run) {
    return
  }
  await fs.rm(run.marker, { force: true })
  activeRuns.delete(dir)
  await cleanFinishedRunDirs(path.dirname(dir), run.keep)
}
