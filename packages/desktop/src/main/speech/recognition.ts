import { ipcMain, globalShortcut, BrowserWindow, app } from "electron"
import { spawn, type ChildProcess } from "child_process"
import path from "path"

let activeSpeechProcess: ChildProcess | null = null
let currentPTTHotkey = "CommandOrControl+Shift+Space"

function registerPTTHotkey(hotkey: string) {
  try {
    if (currentPTTHotkey) {
      globalShortcut.unregister(currentPTTHotkey)
    }
    const cleanHotkey = hotkey.trim()
    if (!cleanHotkey) return

    currentPTTHotkey = cleanHotkey
    const registered = globalShortcut.register(cleanHotkey, () => {
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send("whis-voice-ptt-triggered")
        }
      }
    })

    if (!registered) {
      console.warn("Failed to register PTT global shortcut:", cleanHotkey)
    }
  } catch (err) {
    console.warn("Error registering PTT shortcut:", err)
  }
}

export function registerSpeechRecognitionHandler() {
  registerPTTHotkey(currentPTTHotkey)

  ipcMain.on("whis-voice-set-ptt", (_event, hotkey: string) => {
    if (typeof hotkey === "string" && hotkey.trim()) {
      registerPTTHotkey(hotkey)
    }
  })

  app.on("will-quit", () => {
    globalShortcut.unregisterAll()
  })

  ipcMain.on("whis-speech-start", (event) => {
    if (activeSpeechProcess) {
      try {
        activeSpeechProcess.kill()
      } catch {}
      activeSpeechProcess = null
    }

    if (process.platform !== "win32") {
      return
    }

    // Trigger Windows Voice Typing (Win + H) directly on the focused window
    const scriptPath = path.join(__dirname, "win-voice.ps1")

    try {
      const child = spawn(
        "powershell",
        [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          `
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
    Write-Output "[READY]"
} catch {}
`,
        ],
        {
          windowsHide: true,
        },
      )
      activeSpeechProcess = child

      child.stdout?.on("data", (chunk: Buffer) => {
        const text = chunk.toString()
        if (text.includes("[READY]") && !event.sender.isDestroyed()) {
          event.sender.send("whis-speech-ready")
        }
      })

      child.on("close", () => {
        if (activeSpeechProcess === child) {
          activeSpeechProcess = null
        }
      })
    } catch (err: any) {
      console.warn("Failed to trigger Windows Voice Typing:", err)
    }
  })

  ipcMain.on("whis-speech-stop", () => {
    if (activeSpeechProcess) {
      try {
        activeSpeechProcess.kill()
      } catch {}
      activeSpeechProcess = null
    }
  })
}
