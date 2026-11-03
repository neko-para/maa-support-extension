/** 子进程事件的最小面，便于用假的 child 做单测。 */
export type HandshakeChild = {
  exitCode: number | null
  signalCode: NodeJS.Signals | null
  once(
    event: 'exit',
    listener: (code: number | null, signal: NodeJS.Signals | null) => void
  ): unknown
}

/** 握手期间子进程退出。connectSettled 为 false 表示 native connect 可能仍在执行。 */
export class AgentHandshakeError extends Error {
  constructor(readonly connectSettled: boolean) {
    super('agent 进程在连接握手期间退出')
  }
}

export type AgentHandshakeHooks = {
  /**
   * connect 尚未 settle 就因子进程退出而失败。调用方应等传入的 promise settle 后
   * 再销毁 client，避免与 binding 的 AsyncWork 并发（use-after-free）。
   */
  onStranded?: (settled: Promise<unknown>) => void
}

/**
 * 等待 connect 与子进程退出竞争。
 * 子进程已经/正在退出时立刻失败，不再等满 connectTimeout；connect 正常 settle 时
 * 沿用它的结果（包括 native 的 false 返回值由调用方检查）。
 */
export async function raceAgentHandshake(
  connect: Promise<unknown>,
  child: HandshakeChild,
  hooks: AgentHandshakeHooks = {}
): Promise<void> {
  let settled = false
  const settledConnect = connect.finally(() => {
    settled = true
  })
  // 无论竞速结果如何都要吃掉 rejection，避免 unhandled。
  settledConnect.catch(() => {})

  const exit = new Promise<never>((_, reject) => {
    const fail = () => reject(new AgentHandshakeError(settled))
    if (child.exitCode !== null || child.signalCode !== null) {
      fail()
      return
    }
    child.once('exit', () => fail())
  })
  exit.catch(() => {})

  try {
    await Promise.race([settledConnect, exit])
  } catch (error) {
    if (error instanceof AgentHandshakeError && !error.connectSettled) {
      hooks.onStranded?.(settledConnect)
    }
    throw error
  }
}
