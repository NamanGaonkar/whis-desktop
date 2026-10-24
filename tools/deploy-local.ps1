$ErrorActionPreference = "Stop"

$installDir = "$env:LOCALAPPDATA\Programs\Whis"
$distUnpacked = Join-Path $PSScriptRoot "..\dist\win-unpacked"

Write-Host "1. Terminating running processes..."
Get-Process Whis -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

Write-Host "2. Copying build to $installDir..."
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}
Copy-Item -Path "$distUnpacked\*" -Destination $installDir -Recurse -Force

Write-Host "3. Updating Shortcuts..."
$wscript = New-Object -ComObject WScript.Shell
$desktop = [System.Environment]::GetFolderPath("Desktop")
$startMenu = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"

$shortcuts = @(
    (Join-Path $desktop "Whis.lnk"),
    (Join-Path $startMenu "Whis.lnk")
)

foreach ($sc in $shortcuts) {
    $s = $wscript.CreateShortcut($sc)
    $s.TargetPath = Join-Path $installDir "Whis.exe"
    $s.WorkingDirectory = $installDir
    $s.IconLocation = "$(Join-Path $installDir 'Whis.exe'),0"
    $s.Save()
}

Write-Host "4. Refreshing Windows Shell Icon Cache..."
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class ShellNotifier {
    [DllImport("shell32.dll")]
    public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);
}
"@ -ErrorAction SilentlyContinue
[ShellNotifier]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
Write-Host "Done! Whis deployed locally."
