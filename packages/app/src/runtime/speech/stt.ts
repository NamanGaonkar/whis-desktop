import { createSignal } from "solid-js"

interface IWindowWithSpeech extends Window {
  webkitSpeechRecognition?: any
  SpeechRecognition?: any
}

const [isListening, setIsListening] = createSignal(false)
const [error, setError] = createSignal<string | null>(null)
const [audioLevel, setAudioLevel] = createSignal(0)

export function useSpeechToText() {
  const isSupported =
    typeof window !== "undefined" &&
    (Boolean(
      (window as IWindowWithSpeech).webkitSpeechRecognition ||
        (window as IWindowWithSpeech).SpeechRecognition,
    ) || Boolean(navigator?.mediaDevices?.getUserMedia))

  let activeStream: MediaStream | null = null
  let audioCtx: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let animFrameId: number | null = null
  let recognition: any = null
  let silenceTimer: ReturnType<typeof setTimeout> | null = null
  let userHasSpoken = false

  function cleanupAudio() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
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
    userHasSpoken = false
    setAudioLevel(0)
  }

  function stop() {
    cleanupAudio()
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
  }) {
    stop()
    setError(null)
    userHasSpoken = false

    // 1. Acquire live microphone stream for Audio Analysis & VAD (Silence Detection)
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

    if (!stream && !((window as IWindowWithSpeech).webkitSpeechRecognition || (window as IWindowWithSpeech).SpeechRecognition)) {
      setError("Speech recognition / microphone is not available.")
      return
    }

    setIsListening(true)

    // 2. Set up Web Audio Analyser for Real-time Voice Activity Detection (VAD)
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

          // Speech detection threshold
          if (avg > 14) {
            userHasSpoken = true
            if (silenceTimer) {
              clearTimeout(silenceTimer)
              silenceTimer = null
            }
          } else if (userHasSpoken && options.autoSendEnabled && options.onAutoSend) {
            // User was speaking, now there is silence
            if (!silenceTimer) {
              silenceTimer = setTimeout(() => {
                stop()
                options.onAutoSend?.()
              }, 1500)
            }
          }

          animFrameId = requestAnimationFrame(monitorAudio)
        }

        monitorAudio()
      } catch (err) {
        console.warn("AudioContext analyzer setup failed:", err)
      }
    }

    // 3. Set up SpeechRecognition if supported
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
            userHasSpoken = true
            options.onTranscript(finalChunk, true)
          } else if (interimChunk) {
            userHasSpoken = true
            options.onTranscript(interimChunk, false)
          }
        }

        recognition.onerror = (e: any) => {
          console.warn("Speech recognition status:", e.error)
          if (e.error === "network") {
            // Electron lacks proprietary Google cloud speech keys; keep live VAD active
            setError("Listening... Tip: Win+H activates Windows Voice Typing directly into Whis")
          } else if (e.error !== "no-speech") {
            setError(e.error === "not-allowed" ? "Microphone access blocked" : `Speech: ${e.error}`)
          }
        }

        recognition.onend = () => {
          // If speech recognition ended on its own but audio stream is still active, don't force stop
          if (!activeStream) {
            setIsListening(false)
          }
        }

        recognition.start()
      } catch (err: any) {
        console.warn("SpeechRec start failed:", err)
      }
    }
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
