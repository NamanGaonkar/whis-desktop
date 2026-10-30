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

  function start(options: {
    onTranscript: (text: string, isFinal: boolean) => void
    onAutoSend?: () => void
    autoSendEnabled?: boolean
  }) {
    if (!isSupported) {
      setError("Speech recognition is not supported in this environment.")
      return
    }

    stop()
    setError(null)

    const SpeechRec =
      (window as IWindowWithSpeech).webkitSpeechRecognition ||
      (window as IWindowWithSpeech).SpeechRecognition

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
      if (e.error !== "no-speech") {
        setError(e.error)
      }
      stop()
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    try {
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
