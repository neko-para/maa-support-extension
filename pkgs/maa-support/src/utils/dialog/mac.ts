import { spawn } from 'child_process'

async function launch(script: string) {
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

export function showFolderDialog(prompt: string) {
  return launch(`POSIX path of (choose folder with prompt "${prompt}")`)
}

export function showOpenFileDialog(prompt: string) {
  return launch(`POSIX path of (choose file with prompt "${prompt}")`)
}

export function showSaveFileDialog(prompt: string, filename: string) {
  return launch(
    `POSIX path of (choose file name with prompt "${prompt}" default name "${filename}")`
  )
}
