import { ipcMain } from "electron"
import { spawn, type ChildProcess } from "child_process"

let activeSpeechProcess: ChildProcess | null = null

export function registerSpeechRecognitionHandler() {
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

    const psScript = `
Add-Type -AssemblyName System.Speech
$engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$dict = New-Object System.Speech.Recognition.DictationGrammar
$engine.LoadGrammar($dict)
$engine.SetInputToDefaultAudioDevice()
Write-Output "[READY]"
$engine.add_SpeechRecognized({
  param($s, $e)
  if ($e.Result.Text) {
    Write-Output "[TEXT]$($e.Result.Text)"
  }
})
$engine.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
while ($true) { Start-Sleep -Milliseconds 200 }
`

    try {
      const child = spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", psScript], {
        windowsHide: true,
      })
      activeSpeechProcess = child

      child.stdout?.on("data", (chunk: Buffer) => {
        const text = chunk.toString()
        const lines = text.split(/\r?\n/)
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith("[TEXT]")) {
            const recognized = trimmed.slice(6).trim()
            if (recognized && !event.sender.isDestroyed()) {
              event.sender.send("whis-speech-result", recognized)
            }
          }
        }
      })

      child.stderr?.on("data", (chunk: Buffer) => {
        console.warn("Speech recognizer stderr:", chunk.toString())
      })

      child.on("close", () => {
        if (activeSpeechProcess === child) {
          activeSpeechProcess = null
        }
      })
    } catch (err: any) {
      console.warn("Failed to spawn speech recognizer:", err)
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
