import { createSignal } from "solid-js"
import { transcribeAudioWithWhisper, type WhisperModelSize } from "./whisper-engine"
import { stopKokoroSpeech } from "./kokoro-engine"

export type VADStatus = "idle" | "listening" | "speech_detected" | "transcribing" | "sending" | "error"

const [status, setStatus] = createSignal<VADStatus>("idle")
const [audioLevel, setAudioLevel] = createSignal<number>(0)
const [errorMessage, setErrorMessage] = createSignal<string | null>(null)
const [isListening, setIsListening] = createSignal<boolean>(false)

let mediaStream: MediaStream | null = null
let audioCtx: AudioContext | null = null
let processorNode: ScriptProcessorNode | null = null
let sourceNode: MediaStreamAudioSourceNode | null = null
let animFrameId: number | null = null
let isSpeakingInternal = false
let silenceDurationMs = 0
let lastCheckTime = 0
let recordedChunks: Float32Array[] = []
let activeSessionId = 0

function resampleTo16k(audioBuffer: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return audioBuffer
  const ratio = inputSampleRate / 16000
  const outputLength = Math.round(audioBuffer.length / ratio)
  const output = new Float32Array(outputLength)
  for (let i = 0; i < outputLength; i++) {
    const originalPos = i * ratio
    const index = Math.floor(originalPos)
    const frac = originalPos - index
    const nextIndex = Math.min(index + 1, audioBuffer.length - 1)
    output[i] = audioBuffer[index] * (1 - frac) + audioBuffer[nextIndex] * frac
  }
  return output
}

export function stopVADListening() {
  activeSessionId++
  if (animFrameId) {
    cancelAnimationFrame(animFrameId)
    animFrameId = null
  }
  if (processorNode) {
    try {
      processorNode.onaudioprocess = null
      processorNode.disconnect()
    } catch {}
    processorNode = null
  }
  if (sourceNode) {
    try {
      sourceNode.disconnect()
    } catch {}
    sourceNode = null
  }
  if (audioCtx && audioCtx.state !== "closed") {
    try {
      void audioCtx.close()
    } catch {}
    audioCtx = null
  }
  if (mediaStream) {
    try {
      mediaStream.getTracks().forEach((track) => track.stop())
    } catch {}
    mediaStream = null
  }
  recordedChunks = []
  isSpeakingInternal = false
  silenceDurationMs = 0
  setAudioLevel(0)
  setIsListening(false)
  if (status() !== "error") {
    setStatus("idle")
  }
}

export async function startVADListening(options: {
  silenceThresholdSeconds?: number
  whisperModel?: WhisperModelSize
  onTranscript: (text: string) => void
  onAutoSend?: (transcript: string) => void
  onError?: (errText: string) => void
}) {
  stopVADListening()
  setErrorMessage(null)

  const sessionId = ++activeSessionId

  // Verify microphone support
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

    if (sessionId !== activeSessionId) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }

    mediaStream = stream

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) {
      throw new Error("Web Audio API is not supported in this environment")
    }

    const ctx = new AudioCtx()
    audioCtx = ctx
    if (ctx.state === "suspended") {
      await ctx.resume()
    }

    const sampleRate = ctx.sampleRate
    const source = ctx.createMediaStreamSource(stream)
    sourceNode = source

    // 4096 buffer size gives ~90ms per processing frame
    const processor = ctx.createScriptProcessor(4096, 1, 1)
    processorNode = processor

    const silenceCutoffMs = (options.silenceThresholdSeconds ?? 1.0) * 1000
    // Speech detection threshold (RMS energy)
    const speechThreshold = 0.015

    lastCheckTime = Date.now()

    processor.onaudioprocess = (e) => {
      if (sessionId !== activeSessionId) return

      const input = e.inputBuffer.getChannelData(0)
      const now = Date.now()
      const delta = now - lastCheckTime
      lastCheckTime = now

      // Compute RMS audio volume
      let sum = 0
      for (let i = 0; i < input.length; i++) {
        sum += input[i] * input[i]
      }
      const rms = Math.sqrt(sum / input.length)

      // Update UI level meter (0 to 100)
      const level = Math.min(100, Math.round(rms * 450))
      setAudioLevel(level)

      // Downsample chunk to 16kHz for Whisper
      const resampled = resampleTo16k(input, sampleRate)

      if (rms >= speechThreshold) {
        // User is currently speaking
        if (!isSpeakingInternal) {
          isSpeakingInternal = true
          setStatus("speech_detected")
          // Instant Barge-In: Halt AI speech immediately
          stopKokoroSpeech()
          if (typeof window !== "undefined" && (window as any).__whis_tts?.stop) {
            ;(window as any).__whis_tts.stop()
          }
        }
        silenceDurationMs = 0
        recordedChunks.push(new Float32Array(resampled))
      } else {
        // Energy is below speech threshold (silence/ambient)
        if (isSpeakingInternal) {
          silenceDurationMs += delta
          // Keep a short pad of silence for natural speech cadence
          if (silenceDurationMs < 400) {
            recordedChunks.push(new Float32Array(resampled))
          }

          if (silenceDurationMs >= silenceCutoffMs) {
            // User finished speaking!
            isSpeakingInternal = false
            silenceDurationMs = 0

            const chunks = recordedChunks
            recordedChunks = []

            // Calculate total samples
            let totalLen = 0
            for (let i = 0; i < chunks.length; i++) {
              totalLen += chunks[i].length
            }

            // Only process if speech is at least 300ms (4800 samples at 16kHz)
            if (totalLen >= 4800) {
              const fullAudio = new Float32Array(totalLen)
              let offset = 0
              for (let i = 0; i < chunks.length; i++) {
                fullAudio.set(chunks[i], offset)
                offset += chunks[i].length
              }

              setStatus("transcribing")

              // Run Whisper transcription asynchronously
              void (async () => {
                try {
                  const text = await transcribeAudioWithWhisper(fullAudio, options.whisperModel ?? "tiny.en")
                  if (sessionId !== activeSessionId) return

                  const trimmed = text ? text.trim() : ""
                  if (trimmed.length > 0) {
                    options.onTranscript(trimmed)

                    if (options.onAutoSend) {
                      setStatus("sending")
                      options.onAutoSend(trimmed)
                      if (sessionId === activeSessionId) {
                        setStatus("listening")
                      }
                    } else {
                      setStatus("listening")
                    }
                  } else {
                    setStatus("listening")
                  }
                } catch {
                  if (sessionId === activeSessionId) {
                    setStatus("listening")
                  }
                }
              })()
            } else {
              setStatus("listening")
            }
          }
        }
      }
    }

    source.connect(processor)
    // Connect to a dummy gain node so the audio graph runs without playing mic back into speakers
    const dummyGain = ctx.createGain()
    dummyGain.gain.value = 0
    processor.connect(dummyGain)
    dummyGain.connect(ctx.destination)
  } catch (err: any) {
    console.warn("Microphone initialization error:", err)
    let msg = "Microphone error. Please check Windows sound settings."
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      msg = "Microphone permission denied. Please allow microphone access in Windows Settings."
    } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      msg = "No microphone detected. Please plug in or connect a microphone."
    }
    setErrorMessage(msg)
    setStatus("error")
    options.onError?.(msg)
    stopVADListening()
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
