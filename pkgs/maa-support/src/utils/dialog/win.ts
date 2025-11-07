import { spawn } from 'child_process'

async function launch(script: string) {
  const cp = spawn(
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    ['-command', script],
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

export function showFolderDialog(prompt: string) {
  return launch(`
${fixDpi}

Add-Type -AssemblyName System.Windows.Forms;
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog;
$dlg.Title = "${prompt}";
if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Host $dlg.SelectedPath | Out-Null;;
  exit 0;
} else {
  exit 1;
}
`)
}

export function showOpenFileDialog(prompt: string) {
  return launch(`
${fixDpi}

Add-Type -AssemblyName System.Windows.Forms;
$dlg = New-Object System.Windows.Forms.OpenFileDialog;
$dlg.Title = "${prompt}";
if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Host $dlg.FileName | Out-Null;;
  exit 0;
} else {
  exit 1;
}
`)
}

export function showSaveFileDialog(prompt: string, filename: string) {
  return launch(`
${fixDpi}

Add-Type -AssemblyName System.Windows.Forms;
$dlg = New-Object System.Windows.Forms.SaveFileDialog;
$dlg.Title = "${prompt}";
$dlg.filename = "${filename}";
if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Host $dlg.FileName | Out-Null;;
  exit 0;
} else {
  exit 1;
}
`)
}
