import { spawn } from 'child_process'

const fixDpi = `
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class ProcessDPI {
  [DllImport("user32.dll")]
  public static extern bool SetProcessDPIAware();
}
"@ -PassThru | Out-Null;
[ProcessDPI]::SetProcessDPIAware() | Out-Null;
`

export function launchPowershell(script: string) {
  const cp = spawn(
    process.env.SystemRoot + '\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    ['-command', `${fixDpi}\n${script}`],
    {
      stdio: 'pipe'
    }
  )
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
