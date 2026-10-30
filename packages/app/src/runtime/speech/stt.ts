import { createSignal } from "solid-js"

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

const [isListening, setIsListening] = createSignal(false)
const [error, setError] = createSignal<string | null>(null)
const [audioLevel, setAudioLevel] = createSignal(0)

export function useSpeechToText() {
  const isSupported =
    typeof window !== "undefined" &&
    (Boolean((window as IWindowWithSpeech).electron?.speech) ||
      Boolean(
        (window as IWindowWithSpeech).webkitSpeechRecognition ||
          (window as IWindowWithSpeech).SpeechRecognition,
      ) ||
      Boolean(navigator?.mediaDevices?.getUserMedia))

  let activeStream: MediaStream | null = null
  let audioCtx: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let animFrameId: number | null = null
  let recognition: any = null
  let speechResultCleanup: (() => void) | null = null
  let autoSendIntervalId: ReturnType<typeof setInterval> | null = null

  function cleanupAudio() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }
    if (autoSendIntervalId) {
      clearInterval(autoSendIntervalId)
      autoSendIntervalId = null
    }
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop())
      activeStream = null
    }
    if (audioCtx) {
      try {
        void audioCtx.close()
      } catch {}
      audioCtx = null
    }
    analyser = null
    setAudioLevel(0)
  }

  function stop() {
    cleanupAudio()

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

    if (recognition) {
      try {
        recognition.stop()
      } catch {}
      recognition = null
    }

    setIsListening(false)
  }

  async function start(options: {
    onTranscript: (text: string, isFinal: boolean) => void
    onAutoSend?: () => void
    autoSendEnabled?: boolean
    getEditorText?: () => string
  }) {
    stop()
    setError(null)

    const initialText = options.getEditorText ? options.getEditorText().trim() : ""
    let lastSpeechOrTextTime = Date.now()
    let hasSpoken = false
    let ambientNoiseFloor = 10
    let noiseSamples = 0
    let lastRecordedTextLength = initialText.length

    // 1. Acquire live microphone stream for Audio Analysis
    let stream: MediaStream | null = null
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        activeStream = stream
      } catch (err: any) {
        console.warn("Microphone access failed:", err)
        setError("Microphone permission denied. Please allow microphone in Windows/App settings.")
        setIsListening(false)
        return
      }
    }

    setIsListening(true)

    // 2. Set up Web Audio Analyser
    if (stream && typeof AudioContext !== "undefined") {
      try {
        const ctx = new AudioContext()
        audioCtx = ctx
        const source = ctx.createMediaStreamSource(stream)
        const node = ctx.createAnalyser()
        node.fftSize = 256
        source.connect(node)
        analyser = node

        const buffer = new Uint8Array(node.frequencyBinCount)

        function monitorAudio() {
          if (!analyser) return
          analyser.getByteFrequencyData(buffer)
          let sum = 0
          for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i]
          }
          const avg = sum / buffer.length
          setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)))

          // Adaptive noise floor calibration
          if (noiseSamples < 30) {
            ambientNoiseFloor = Math.max(8, (ambientNoiseFloor * noiseSamples + avg) / (noiseSamples + 1))
            noiseSamples++
          }

          // Real speech detected by audio volume
          if (avg > ambientNoiseFloor + 12) {
            lastSpeechOrTextTime = Date.now()
          }

          animFrameId = requestAnimationFrame(monitorAudio)
        }

        monitorAudio()
      } catch (err) {
        console.warn("AudioContext setup failed:", err)
      }
    }

    // 3. Trigger Native Windows Voice Typing (Win + H) if running in Desktop Electron
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
        console.warn("Native electron speech start failed:", err)
      }
    }

    // 4. Web Speech API (runs in parallel or as fallback)
    const SpeechRec =
      (window as IWindowWithSpeech).webkitSpeechRecognition ||
      (window as IWindowWithSpeech).SpeechRecognition

    if (SpeechRec) {
      try {
        recognition = new SpeechRec()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = "en-US"

        recognition.onresult = (event: any) => {
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

        recognition.onerror = (e: any) => {
          console.warn("Speech recognition status:", e.error)
          if (e.error === "network") {
            setError("Listening... Tip: Win+H activates Windows Voice Typing directly into Whis")
          } else if (e.error !== "no-speech") {
            setError(e.error === "not-allowed" ? "Microphone access blocked" : `Speech: ${e.error}`)
          }
        }

        recognition.onend = () => {
          if (!activeStream) {
            setIsListening(false)
          }
        }

        recognition.start()
      } catch (err: any) {
        console.warn("SpeechRec start failed:", err)
      }
    }

    // 5. Rock-Solid Auto-Send Monitor Loop (100ms interval)
    // Tracks both dictated text growth in the editor and speech pause duration
    autoSendIntervalId = setInterval(() => {
      const now = Date.now()
      const currentEditorText = options.getEditorText ? options.getEditorText().trim() : ""
      const currentLength = currentEditorText.length

      // Detect if text was dictated or typed into editor
      if (currentLength > 0) {
        if (currentLength !== lastRecordedTextLength) {
          hasSpoken = true
          lastSpeechOrTextTime = now
          lastRecordedTextLength = currentLength
        }
      }

      // If user has dictated text and auto-send is enabled:
      if (hasSpoken && currentLength > 0 && options.autoSendEnabled !== false && options.onAutoSend) {
        const silenceDuration = now - lastSpeechOrTextTime
        // 1.0s silence after speech completion = Send immediately
        if (silenceDuration >= 1000) {
          stop()
          options.onAutoSend()
          return
        }
      }

      // Safety: Idle timeout if user opened mic but never spoke for 15 seconds
      if (!hasSpoken && now - lastSpeechOrTextTime > 15000) {
        stop()
      }
    }, 100)
  }

  return {
    isSupported,
    isListening,
    audioLevel,
    error,
    start,
    stop,
  }
}
