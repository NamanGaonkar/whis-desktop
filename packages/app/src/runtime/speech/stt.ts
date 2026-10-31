import { useVADEngine, startVADListening, stopVADListening } from "./vad-engine"
import type { WhisperModelSize } from "./whisper-engine"

export interface SpeechToTextOptions {
  onTranscript: (text: string, isFinal: boolean) => void
  onAutoSend?: (transcript: string) => void
  autoSendEnabled?: boolean
  silenceThresholdSeconds?: number
  whisperModel?: WhisperModelSize
  getEditorText?: () => string
}

export function useSpeechToText() {
  const vad = useVADEngine()

  const isSupported = typeof window !== "undefined" && Boolean(navigator?.mediaDevices?.getUserMedia)

  function start(options: SpeechToTextOptions) {
    startVADListening({
      silenceThresholdSeconds: options.silenceThresholdSeconds ?? 1.0,
      whisperModel: options.whisperModel ?? "tiny.en",
      onTranscript: (text: string) => {
        options.onTranscript(text, true)
      },
      onAutoSend: (transcript: string) => {
        if (options.autoSendEnabled !== false) {
          options.onAutoSend?.(transcript)
        }
      },
      onError: (err: string) => {
        console.warn("STT error:", err)
      },
    })
  }

  function stop() {
    stopVADListening()
  }

  return {
    isSupported,
    isListening: vad.isListening,
    audioLevel: vad.audioLevel,
    status: vad.status,
    error: vad.errorMessage,
    start,
    stop,
  }
}
