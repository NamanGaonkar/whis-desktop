import { createSignal } from "solid-js"
import { transcribeAudioWithWhisper, type WhisperModelSize } from "./whisper-engine"
import { stopKokoroSpeech } from "./kokoro-engine"

export type VADStatus = "idle" | "listening" | "speech_detected" | "transcribing" | "sending" | "error"

const [status, setStatus] = createSignal<VADStatus>("idle")
const [audioLevel, setAudioLevel] = createSignal<number>(0)
const [errorMessage, setErrorMessage] = createSignal<string | null>(null)
const [isListening, setIsListening] = createSignal<boolean>(false)

let activeVAD: any = null
let audioLevelAnalyser: AnalyserNode | null = null
let audioCtx: AudioContext | null = null
let animFrameId: number | null = null

function cleanupAudioLevelMeter() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId)
    animFrameId = null
  }
  if (audioCtx && audioCtx.state !== "closed") {
    try {
      void audioCtx.close()
    } catch {}
  }
  audioCtx = null
  audioLevelAnalyser = null
  setAudioLevel(0)
}

function startAudioLevelMeter(stream: MediaStream) {
  cleanupAudioLevelMeter()
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    audioCtx = ctx
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    audioLevelAnalyser = analyser

    const buffer = new Uint8Array(analyser.frequencyBinCount)

    function update() {
      if (!audioLevelAnalyser) return
      audioLevelAnalyser.getByteFrequencyData(buffer)
      let sum = 0
      for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i]
      }
      const avg = sum / buffer.length
      setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)))
      animFrameId = requestAnimationFrame(update)
    }

    update()
  } catch {}
}

export async function startVADListening(options: {
  silenceThresholdSeconds?: number
  whisperModel?: WhisperModelSize
  onTranscript: (text: string) => void
  onAutoSend?: () => void
  onError?: (errText: string) => void
}) {
  stopVADListening()
  setErrorMessage(null)

  // Verify microphone support and permissions
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    const msg = "Audio recording is not supported on this device"
    setErrorMessage(msg)
    setStatus("error")
    options.onError?.(msg)
    return
  }

  setStatus("listening")
  setIsListening(true)

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    startAudioLevelMeter(stream)

    const { MicVAD } = await import("@ricky0123/vad-web")

    const silenceSeconds = options.silenceThresholdSeconds ?? 1.0
    // Silero VAD runs ~30 frames/sec; redemptionFrames defines the silence duration before speech cut
    const redemptionFrames = Math.max(15, Math.min(60, Math.round(silenceSeconds * 30)))

    const vad = await (MicVAD.new as any)({
      stream,
      positiveSpeechThreshold: 0.75,
      negativeSpeechThreshold: 0.35,
      redemptionFrames,
      preSpeechPadFrames: 5,
      onSpeechStart: () => {
        // Instant Barge-In: immediately interrupt any AI spoken output
        stopKokoroSpeech()
        setStatus("speech_detected")
      },
      onVADMisfire: () => {
        setStatus("listening")
      },
      onSpeechEnd: async (audio: Float32Array) => {
        if (!audio || audio.length < 3200) {
          // Less than 200ms is likely a click or cough
          setStatus("listening")
          return
        }

        setStatus("transcribing")

        try {
          const text = await transcribeAudioWithWhisper(audio, options.whisperModel ?? "base")
          if (text && text.trim().length > 0) {
            options.onTranscript(text.trim())

            if (options.onAutoSend) {
              setStatus("sending")
              setTimeout(() => {
                options.onAutoSend?.()
                setStatus("listening")
              }, 60)
            } else {
              setStatus("listening")
            }
          } else {
            setStatus("listening")
          }
        } catch {
          setStatus("listening")
        }
      },
    })

    activeVAD = vad
    vad.start()
  } catch (err: any) {
    console.warn("VAD initiation error:", err)
    let msg = "Microphone error. Please check Windows sound settings."
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      msg = "Microphone access blocked. Please allow microphone in Windows Settings."
    } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      msg = "No microphone detected. Please connect a microphone."
    }
    setErrorMessage(msg)
    setStatus("error")
    options.onError?.(msg)
    stopVADListening()
  }
}

export function stopVADListening() {
  if (activeVAD) {
    try {
      activeVAD.pause()
      activeVAD.destroy()
    } catch {}
    activeVAD = null
  }
  cleanupAudioLevelMeter()
  setIsListening(false)
  if (status() !== "error") {
    setStatus("idle")
  }
}

export function useVADEngine() {
  return {
    status,
    audioLevel,
    errorMessage,
    isListening,
    start: startVADListening,
    stop: stopVADListening,
  }
}
