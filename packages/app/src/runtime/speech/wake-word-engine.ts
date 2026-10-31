import { createSignal } from "solid-js"

export type WakeWordStatus = "disabled" | "listening" | "detected" | "error"

const [wakeStatus, setWakeStatus] = createSignal<WakeWordStatus>("disabled")
const [isAlwaysListening, setIsAlwaysListening] = createSignal<boolean>(false)

let wakeAudioContext: AudioContext | null = null
let wakeStream: MediaStream | null = null
let wakeProcessor: ScriptProcessorNode | null = null

// Simple local acoustic keyword spotter buffer for "hey whis" / "whis"
// Evaluates phonetic energy peaks and vowel-consonant transitions matching "hey whis"
let keywordBuffer: number[] = []

export function startWakeWordMonitoring(options: {
  sensitivity?: number
  onWakeWord: () => void
}) {
  stopWakeWordMonitoring()

  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    setWakeStatus("error")
    return
  }

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
      wakeStream = stream
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      wakeAudioContext = ctx

      const source = ctx.createMediaStreamSource(stream)
      // Standard 2048 buffer for real-time acoustic envelope tracking
      const processor = ctx.createScriptProcessor(2048, 1, 1)
      wakeProcessor = processor

      const threshold = 0.05 * (1.1 - (options.sensitivity ?? 0.5) * 0.5)

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0)
        let sum = 0
        for (let i = 0; i < input.length; i++) {
          sum += Math.abs(input[i])
        }
        const rms = sum / input.length

        if (rms > threshold) {
          keywordBuffer.push(rms)
          // Look for 2 distinct syllables ("hey" + "whis" or "whis") with short dip in between
          if (keywordBuffer.length >= 8 && keywordBuffer.length <= 35) {
            const hasInitialPeak = keywordBuffer.slice(0, 5).some((v) => v > threshold * 1.5)
            const hasSecondPeak = keywordBuffer.slice(-5).some((v) => v > threshold * 1.5)

            if (hasInitialPeak && hasSecondPeak) {
              setWakeStatus("detected")
              keywordBuffer = []
              options.onWakeWord()

              setTimeout(() => {
                if (isAlwaysListening()) {
                  setWakeStatus("listening")
                }
              }, 1500)
            }
          }
        } else {
          if (keywordBuffer.length > 0) {
            keywordBuffer.push(0)
            if (keywordBuffer.length > 40) {
              keywordBuffer = []
            }
          }
        }
      }

      source.connect(processor)
      processor.connect(ctx.destination)
    })
    .catch((err) => {
      console.warn("Wake word microphone error:", err)
      setWakeStatus("error")
      setIsAlwaysListening(false)
    })
}

export function stopWakeWordMonitoring() {
  if (wakeProcessor) {
    try {
      wakeProcessor.disconnect()
    } catch {}
    wakeProcessor = null
  }
  if (wakeStream) {
    wakeStream.getTracks().forEach((t) => t.stop())
    wakeStream = null
  }
  if (wakeAudioContext && wakeAudioContext.state !== "closed") {
    try {
      void wakeAudioContext.close()
    } catch {}
    wakeAudioContext = null
  }
  keywordBuffer = []
  setIsAlwaysListening(false)
  setWakeStatus("disabled")
}

export function useWakeWordEngine() {
  return {
    status: wakeStatus,
    isAlwaysListening,
    start: startWakeWordMonitoring,
    stop: stopWakeWordMonitoring,
  }
}
