import { FileDialogBaseImpl, FileDialogOption } from '../base/filedialog'
import { launchPowershell } from './utils'

export class FileDialogWinImpl extends FileDialogBaseImpl {
  async openFile(option: FileDialogOption): Promise<string[] | null> {
    const result = await launchPowershell(`
Add-Type -AssemblyName System.Windows.Forms;
$dlg = New-Object System.Windows.Forms.OpenFileDialog;
$dialog.Multiselect = ${option.multi ? '$true' : '$false'};
${option.title ? `$dlg.Title = "${option.title}";` : ''}
${option.defaultFolder ? `$dlg.InitialDirectory = "${option.defaultFolder}";` : ''}
if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Host ($dlg.FileNames -join "\`n") | Out-Null;
  exit 0;
} else {
  exit 1;
}
`)
    if (result) {
      return result.split('\n').filter(x => !!x)
    } else {
      return null
    }
  }

  async saveFile(option: FileDialogOption): Promise<string | null> {
    return launchPowershell(`
Add-Type -AssemblyName System.Windows.Forms;
$dlg = New-Object System.Windows.Forms.SaveFileDialog;
${option.defaultFile ? `$dlg.filename = "${option.defaultFile}` : ''}
${option.title ? `$dlg.Title = "${option.title}";` : ''}
${option.defaultFolder ? `$dlg.InitialDirectory = "${option.defaultFolder}";` : ''}
if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Host $dlg.FileName | Out-Null;
  exit 0;
} else {
  exit 1;
}
`)
  }

  async openFolder(option: FileDialogOption): Promise<string[] | null> {
    const result = await launchPowershell(`
Add-Type -AssemblyName System.Windows.Forms;
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog;
$dialog.Multiselect = ${option.multi ? '$true' : '$false'};
${option.title ? `$dlg.Title = "${option.title}";` : ''}
${option.defaultFolder ? `$dlg.InitialDirectory = "${option.defaultFolder}";` : ''}
if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Host ($dlg.SelectedPaths -join "\`n") | Out-Null;;
  exit 0;
} else {
  exit 1;
}
`)
    if (result) {
      return result.split('\n').filter(x => !!x)
    } else {
      return null
    }
  }
}
