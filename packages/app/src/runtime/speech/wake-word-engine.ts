import { createSignal } from "solid-js"
import { transcribeAudioWithWhisper } from "./whisper-engine"

export type WakeWordStatus = "disabled" | "listening" | "detected" | "error"

const [wakeStatus, setWakeStatus] = createSignal<WakeWordStatus>("disabled")
const [isAlwaysListening, setIsAlwaysListening] = createSignal<boolean>(false)

let wakeAudioContext: AudioContext | null = null
let wakeStream: MediaStream | null = null
let wakeProcessor: ScriptProcessorNode | null = null
let isWakeChecking = false
let wakeSessionId = 0

function playWakeChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.07) // A5
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.22)
  } catch {}
}

function resampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return input
  const ratio = inputSampleRate / 16000
  const outputLength = Math.round(input.length / ratio)
  const result = new Float32Array(outputLength)
  for (let i = 0; i < outputLength; i++) {
    const originalPos = i * ratio
    const index = Math.floor(originalPos)
    const frac = originalPos - index
    const s0 = input[index] ?? 0
    const s1 = input[index + 1] ?? s0
    result[i] = s0 + frac * (s1 - s0)
  }
  return result
}

export function startWakeWordMonitoring(options: {
  sensitivity?: number
  onWakeWord: () => void
}) {
  stopWakeWordMonitoring()

  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    setWakeStatus("error")
    return
  }

  const sessionId = ++wakeSessionId
  setWakeStatus("listening")
  setIsAlwaysListening(true)

  navigator.mediaDevices
    .getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
    .then((stream) => {
      if (sessionId !== wakeSessionId) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      wakeStream = stream
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      wakeAudioContext = ctx

      const sampleRate = ctx.sampleRate
      const source = ctx.createMediaStreamSource(stream)
      const processor = ctx.createScriptProcessor(4096, 1, 1)
      wakeProcessor = processor

      let recordedChunks: Float32Array[] = []
      let speechStarted = false
      let speechDurationMs = 0
      let silenceDurationMs = 0
      const threshold = 0.018 * (1.2 - (options.sensitivity ?? 0.5) * 0.4)

      processor.onaudioprocess = (e) => {
        if (sessionId !== wakeSessionId || isWakeChecking) return

        const input = e.inputBuffer.getChannelData(0)
        let sum = 0
        for (let i = 0; i < input.length; i++) {
          sum += input[i] * input[i]
        }
        const rms = Math.sqrt(sum / input.length)
        const resampled = resampleTo16k(input, sampleRate)
        const frameMs = (input.length / sampleRate) * 1000

        if (rms >= threshold) {
          speechStarted = true
          silenceDurationMs = 0
          speechDurationMs += frameMs
          recordedChunks.push(new Float32Array(resampled))

          // Cap buffer at 3.0s to avoid runaway memory
          if (speechDurationMs > 3000) {
            speechStarted = false
            speechDurationMs = 0
            recordedChunks = []
          }
        } else {
          if (speechStarted) {
            silenceDurationMs += frameMs
            recordedChunks.push(new Float32Array(resampled))

            // After 350ms pause, check if the uttered phrase matches "Hey Whis" or "Whis"
            if (silenceDurationMs >= 350) {
              speechStarted = false
              silenceDurationMs = 0

              // Only phrases between 0.35s and 2.5s can be "Hey Whis"
              if (speechDurationMs >= 350 && speechDurationMs <= 2500) {
                let totalLen = 0
                for (let i = 0; i < recordedChunks.length; i++) {
                  totalLen += recordedChunks[i].length
                }

                if (totalLen >= 4800) {
                  const clip = new Float32Array(totalLen)
                  let offset = 0
                  for (let i = 0; i < recordedChunks.length; i++) {
                    clip.set(recordedChunks[i], offset)
                    offset += recordedChunks[i].length
                  }

                  recordedChunks = []
                  isWakeChecking = true

                  void (async () => {
                    try {
                      const text = await transcribeAudioWithWhisper(clip, "tiny.en")
                      const clean = text.toLowerCase().trim()

                      // Detect "hey whis", "whis", "whiss", "hey whiz", "hey with" (common phonetic match)
                      if (
                        /\b(hey\s+)?whi[sz]+\b/i.test(clean) ||
                        /\b(hey\s+)?whiss\b/i.test(clean) ||
                        clean.includes("hey whis") ||
                        clean === "whis"
                      ) {
                        setWakeStatus("detected")
                        playWakeChime()
                        stopWakeWordMonitoring()
                        options.onWakeWord()
                      }
                    } catch {} finally {
                      isWakeChecking = false
                    }
                  })()
                }
              }
              recordedChunks = []
              speechDurationMs = 0
            }
          }
        }
      }

      source.connect(processor)
      const dummyGain = ctx.createGain()
      dummyGain.gain.value = 0
      processor.connect(dummyGain)
      dummyGain.connect(ctx.destination)
    })
    .catch((err) => {
      console.warn("Wake word mic error:", err)
      setWakeStatus("error")
      setIsAlwaysListening(false)
    })
}

export function stopWakeWordMonitoring() {
  wakeSessionId++
  if (wakeProcessor) {
    try {
      wakeProcessor.disconnect()
    } catch {}
    wakeProcessor = null
  }
  if (wakeAudioContext && wakeAudioContext.state !== "closed") {
    try {
      void wakeAudioContext.close()
    } catch {}
    wakeAudioContext = null
  }
  if (wakeStream) {
    try {
      wakeStream.getTracks().forEach((track) => track.stop())
    } catch {}
    wakeStream = null
  }
  isWakeChecking = false
  setIsAlwaysListening(false)
  if (wakeStatus() !== "error") {
    setWakeStatus("disabled")
  }
}

export function useWakeWordEngine() {
  return {
    status: wakeStatus,
    isAlwaysListening,
    start: startWakeWordMonitoring,
    stop: stopWakeWordMonitoring,
  }
}
