$source = @'
using System;
using System.Runtime.InteropServices;
public class WinVoiceTyping {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    public static void Trigger() {
        keybd_event(0x5B, 0, 0, UIntPtr.Zero);
        keybd_event(0x48, 0, 0, UIntPtr.Zero);
        keybd_event(0x48, 0, 2, UIntPtr.Zero);
        keybd_event(0x5B, 0, 2, UIntPtr.Zero);
    }
}
'@

try {
    Add-Type -TypeDefinition $source
    [WinVoiceTyping]::Trigger()
    Write-Output "[WIN_VOICE_TRIGGERED]"
} catch {
    Write-Error $_
}
