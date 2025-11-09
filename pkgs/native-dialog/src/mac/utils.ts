import { spawn } from 'child_process'

export async function launchOSAScript(script: string) {
  const cp = spawn('/usr/bin/osascript', ['-e', script], {
    stdio: 'pipe'
  })
  return new Promise<string | null>(resolve => {
    let result: string = ''
    cp.stdout.on('data', data => {
      result += data.toString()
    })
    cp.on('close', code => {
      if (code === 0) {
        resolve(result.trim())
      } else {
        resolve(null)
      }
    })
    cp.on('error', () => {
      resolve(null)
    })
  })
}
