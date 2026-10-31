import { createSignal } from "solid-js"
import { useVADEngine, startVADListening, stopVADListening } from "./vad-engine"
import type { WhisperModelSize } from "./whisper-engine"

interface IWindowWithSpeech extends Window {
  webkitSpeechRecognition?: any
  SpeechRecognition?: any
  electron?: {
    speech?: {
      start: () => void
      stop: () => void
      onResult: (callback: (text: string) => void) => () => void
    }
  }
}

export type STTEngineType = "windows" | "whisper"

export interface SpeechToTextOptions {
  engine?: STTEngineType
  onTranscript: (text: string, isFinal: boolean) => void
  onAutoSend?: (transcript: string) => void
  autoSendEnabled?: boolean
  silenceThresholdSeconds?: number
  whisperModel?: WhisperModelSize
  getEditorText?: () => string
}

const [isWindowsListening, setIsWindowsListening] = createSignal(false)
const [windowsAudioLevel, setWindowsAudioLevel] = createSignal(0)
const [windowsError, setWindowsError] = createSignal<string | null>(null)

let activeStream: MediaStream | null = null
let audioCtx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let animFrameId: number | null = null
let autoSendIntervalId: any = null
let speechResultCleanup: (() => void) | null = null
let activeSpeechRec: any = null

function stopWindowsSpeech() {
  if (speechResultCleanup) {
    try {
      speechResultCleanup()
    } catch {}
    speechResultCleanup = null
  }

  const electronSpeech = typeof window !== "undefined" ? (window as IWindowWithSpeech).electron?.speech : undefined
  if (electronSpeech) {
    try {
      electronSpeech.stop()
    } catch {}
  }

  if (activeSpeechRec) {
    try {
      activeSpeechRec.stop()
      activeSpeechRec.abort()
    } catch {}
    activeSpeechRec = null
  }

  if (autoSendIntervalId) {
    clearInterval(autoSendIntervalId)
    autoSendIntervalId = null
  }

  if (animFrameId) {
    cancelAnimationFrame(animFrameId)
    animFrameId = null
  }

  if (activeStream) {
    try {
      activeStream.getTracks().forEach((track) => track.stop())
    } catch {}
    activeStream = null
  }

  if (audioCtx && audioCtx.state !== "closed") {
    try {
      void audioCtx.close()
    } catch {}
    audioCtx = null
  }

  analyser = null
  setWindowsAudioLevel(0)
  setIsWindowsListening(false)
}

function startWindowsSpeech(options: SpeechToTextOptions) {
  stopWindowsSpeech()
  setWindowsError(null)
  setIsWindowsListening(true)

  let hasSpoken = false
  let lastSpeechOrTextTime = Date.now()
  let lastRecordedTextLength = options.getEditorText ? options.getEditorText().trim().length : 0
  let ambientNoiseFloor = 10
  let noiseSamples = 0
  const silenceThresholdMs = (options.silenceThresholdSeconds ?? 1.0) * 1000

  // 1. Acquire microphone for audio level metering & volume activity tracking
  if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      .then((stream) => {
        if (!isWindowsListening()) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        activeStream = stream

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioCtx) return
        const ctx = new AudioCtx()
        audioCtx = ctx
        const source = ctx.createMediaStreamSource(stream)
        const node = ctx.createAnalyser()
        node.fftSize = 256
        source.connect(node)
        analyser = node

        const buffer = new Uint8Array(node.frequencyBinCount)

        function monitorAudio() {
          if (!analyser || !isWindowsListening()) return
          analyser.getByteFrequencyData(buffer)
          let sum = 0
          for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i]
          }
          const avg = sum / buffer.length
          setWindowsAudioLevel(Math.min(100, Math.round((avg / 128) * 100)))

          if (noiseSamples < 30) {
            ambientNoiseFloor = Math.max(8, (ambientNoiseFloor * noiseSamples + avg) / (noiseSamples + 1))
            noiseSamples++
          }

          if (avg > ambientNoiseFloor + 12) {
            hasSpoken = true
            lastSpeechOrTextTime = Date.now()
          }

          animFrameId = requestAnimationFrame(monitorAudio)
        }

        monitorAudio()
      })
      .catch((err) => {
        console.warn("Audio meter setup error:", err)
      })
  }

  // 2. Trigger native Windows Voice Typing (Win + H) via Electron
  const electronSpeech = typeof window !== "undefined" ? (window as IWindowWithSpeech).electron?.speech : undefined
  if (electronSpeech) {
    try {
      speechResultCleanup = electronSpeech.onResult((text: string) => {
        if (text && text.trim()) {
          hasSpoken = true
          lastSpeechOrTextTime = Date.now()
          options.onTranscript(text.trim(), true)
        }
      })
      electronSpeech.start()
    } catch (err) {
      console.warn("Electron speech start failed:", err)
    }
  }

  // 3. Fallback Web Speech API if supported
  const SpeechRec =
    (window as IWindowWithSpeech).webkitSpeechRecognition ||
    (window as IWindowWithSpeech).SpeechRecognition

  if (SpeechRec && !electronSpeech) {
    try {
      const rec = new SpeechRec()
      activeSpeechRec = rec
      rec.continuous = true
      rec.interimResults = true
      rec.lang = "en-US"

      rec.onresult = (event: any) => {
        let finalChunk = ""
        let interimChunk = ""

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i]
          if (item.isFinal) {
            finalChunk += item[0].transcript
          } else {
            interimChunk += item[0].transcript
          }
        }

        if (finalChunk) {
          hasSpoken = true
          lastSpeechOrTextTime = Date.now()
          options.onTranscript(finalChunk, true)
        } else if (interimChunk) {
          hasSpoken = true
          lastSpeechOrTextTime = Date.now()
          options.onTranscript(interimChunk, false)
        }
      }

      rec.onerror = (e: any) => {
        if (e.error !== "no-speech") {
          setWindowsError(e.error === "not-allowed" ? "Microphone access blocked" : `Speech: ${e.error}`)
        }
      }

      rec.start()
    } catch {}
  }

  // 4. Reliable Auto-Send Detection Loop (checks every 80ms)
  autoSendIntervalId = setInterval(() => {
    const now = Date.now()
    const currentText = options.getEditorText ? options.getEditorText().trim() : ""
    const currentLength = currentText.length

    if (currentLength > 0) {
      if (currentLength !== lastRecordedTextLength) {
        hasSpoken = true
        lastSpeechOrTextTime = now
        lastRecordedTextLength = currentLength
      }
    }

    if (hasSpoken && currentLength > 0 && options.autoSendEnabled !== false && options.onAutoSend) {
      const silenceDuration = now - lastSpeechOrTextTime
      if (silenceDuration >= silenceThresholdMs) {
        stopWindowsSpeech()
        options.onAutoSend(currentText)
        return
      }
    }

    if (!hasSpoken && now - lastSpeechOrTextTime > 15000) {
      stopWindowsSpeech()
    }
  }, 80)
}

export function useSpeechToText() {
  const vad = useVADEngine()

  const isSupported = typeof window !== "undefined" && Boolean(navigator?.mediaDevices?.getUserMedia)

  function start(options: SpeechToTextOptions) {
    const engine = options.engine ?? "windows"

    if (engine === "windows") {
      stopVADListening()
      startWindowsSpeech(options)
    } else {
      stopWindowsSpeech()
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
  }

  function stop() {
    stopWindowsSpeech()
    stopVADListening()
  }

  const isListening = () => isWindowsListening() || vad.isListening()
  const audioLevel = () => (isWindowsListening() ? windowsAudioLevel() : vad.audioLevel())
  const status = () => (isWindowsListening() ? (isWindowsListening() ? "listening" : "idle") : vad.status())
  const error = () => (isWindowsListening() ? windowsError() : vad.errorMessage())

  return {
    isSupported,
    isListening,
    audioLevel,
    status,
    error,
    start,
    stop,
  }
}
