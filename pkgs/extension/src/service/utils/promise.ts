export function makePromise<T>() {
  let res: (value: T) => void = () => {}
  const pro = new Promise<T>(resolve => {
    res = resolve
  })
  return [pro, res] as [Promise<T>, (value: T) => void]
}

export type ConnectionWaitResult = 'connected' | 'failed' | 'process-exited' | 'timeout'

export async function waitForConnection(
  connection: Promise<boolean>,
  processClosed: Promise<void>,
  timeoutMs: number
): Promise<ConnectionWaitResult> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<ConnectionWaitResult>(resolve => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs)
  })

  try {
    return await Promise.race([
      connection.then(connected => (connected ? 'connected' : 'failed')),
      processClosed.then(() => 'process-exited' as const),
      timeout
    ])
  } finally {
    clearTimeout(timer)
  }
}
