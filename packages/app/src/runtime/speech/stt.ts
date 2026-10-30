import { createSignal } from "solid-js"

interface IWindowWithSpeech extends Window {
  webkitSpeechRecognition?: any
  SpeechRecognition?: any
}

const [isListening, setIsListening] = createSignal(false)
const [error, setError] = createSignal<string | null>(null)

export function useSpeechToText() {
  const isSupported =
    typeof window !== "undefined" &&
    Boolean(
      (window as IWindowWithSpeech).webkitSpeechRecognition ||
        (window as IWindowWithSpeech).SpeechRecognition,
    )

  let recognition: any = null
  let silenceTimer: ReturnType<typeof setTimeout> | null = null

  function stop() {
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
    if (recognition) {
      try {
        recognition.stop()
      } catch {
        // Ignored
      }
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

    // First request microphone permission from the browser/Electron session
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        // Close temporary stream track so speech recognition engine can capture the device
        stream.getTracks().forEach((track) => track.stop())
      } catch (err: any) {
        console.warn("Microphone access request failed:", err)
        setError("Microphone permission denied. Please allow microphone access.")
        setIsListening(false)
        return
      }
    }

    const SpeechRec =
      (window as IWindowWithSpeech).webkitSpeechRecognition ||
      (window as IWindowWithSpeech).SpeechRecognition

    if (!SpeechRec) {
      setError("Speech recognition is not available in this environment.")
      return
    }

    try {
      recognition = new SpeechRec()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "en-US"

      function resetSilenceTimer() {
        if (silenceTimer) clearTimeout(silenceTimer)
        if (options.autoSendEnabled && options.onAutoSend) {
          silenceTimer = setTimeout(() => {
            stop()
            options.onAutoSend?.()
          }, 1500)
        }
      }

      recognition.onstart = () => {
        setIsListening(true)
        setError(null)
      }

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
          options.onTranscript(finalChunk, true)
          resetSilenceTimer()
        } else if (interimChunk) {
          options.onTranscript(interimChunk, false)
          resetSilenceTimer()
        }
      }

      recognition.onerror = (e: any) => {
        console.warn("Speech recognition error:", e.error)
        if (e.error !== "no-speech") {
          setError(e.error === "not-allowed" ? "Microphone access blocked" : `Speech: ${e.error}`)
        }
        stop()
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.start()
    } catch (err: any) {
      setError(err?.message ?? "Failed to start microphone")
      stop()
    }
  }

  return {
    isSupported,
    isListening,
    error,
    start,
    stop,
  }
}
