import { createSignal } from "solid-js"
import { normalizeForSpeech } from "./normalizer"
import {
  speakWithKokoro,
  stopKokoroSpeech,
  KOKORO_VOICES,
  useKokoroEngine,
} from "./kokoro-engine"

export interface VoiceOption {
  id: string
  name: string
  lang: string
  isNatural: boolean
}

const [isSystemSpeaking, setIsSystemSpeaking] = createSignal(false)
const [availableSystemVoices, setAvailableSystemVoices] = createSignal<VoiceOption[]>([])

let currentUtterance: SpeechSynthesisUtterance | null = null
let systemPlaybackSession = 0

function cleanVoiceName(rawName: string, lang: string): string {
  const name = rawName
    .replace(/^Microsoft\s+/i, "")
    .replace(/^Google\s+/i, "")
    .replace(/\s+-\s+English\s+\(United States\)/i, "")
    .replace(/\s+-\s+English\s+\(United Kingdom\)/i, " (UK)")
    .replace(/\s+-\s+English\s+\(India\)/i, " (India)")
    .replace(/\s+-\s+English\s+\(Australia\)/i, " (AU)")
    .replace(/\s+Desktop/i, "")
    .trim()

  return name || `${lang} Voice`
}

function updateSystemVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  const voices = window.speechSynthesis.getVoices()
  if (!voices || voices.length === 0) return

  const english = voices
    .filter((v) => v.lang.startsWith("en") || !v.lang)
    .map((v) => ({
      id: v.name,
      name: cleanVoiceName(v.name, v.lang),
      lang: v.lang,
      isNatural: v.name.includes("Natural") || v.name.includes("Online"),
    }))
    .sort((a, b) => {
      if (a.isNatural && !b.isNatural) return -1
      if (!a.isNatural && b.isNatural) return 1
      return a.name.localeCompare(b.name)
    })

  if (english.length > 0) {
    setAvailableSystemVoices(english)
  }
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  updateSystemVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    updateSystemVoices()
  }
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function useTextToSpeech() {
  const kokoro = useKokoroEngine()

  if (availableSystemVoices().length === 0) {
    updateSystemVoices()
  }

  function stop() {
    systemPlaybackSession++
    stopKokoroSpeech()
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      if (currentUtterance) {
        currentUtterance.onend = null
        currentUtterance.onerror = null
      }
      window.speechSynthesis.cancel()
    }
    currentUtterance = null
    setIsSystemSpeaking(false)
  }

  function speakSystem(
    rawText: string,
    options?: {
      voice?: string
      speed?: number
      onSentenceStart?: (sentence: string, index: number, total: number) => void
    },
  ) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return

    const clean = normalizeForSpeech(rawText)
    if (!clean.trim()) return

    const sentences = splitIntoSentences(clean)
    if (sentences.length === 0) return

    stop()
    const sessionId = ++systemPlaybackSession

    const voices = window.speechSynthesis.getVoices()
    const preferred = options?.voice
    let matchedVoice: SpeechSynthesisVoice | undefined

    if (preferred && preferred.trim()) {
      matchedVoice = voices.find((v) => v.name === preferred)
      if (!matchedVoice) {
        const lower = preferred.toLowerCase()
        matchedVoice = voices.find((v) => v.name.toLowerCase().includes(lower))
      }
    }
    if (!matchedVoice) {
      matchedVoice =
        voices.find((v) => v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Online"))) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices[0]
    }

    const rate = Math.max(0.6, Math.min(1.8, options?.speed ?? 1.0))
    setIsSystemSpeaking(true)

    let index = 0

    function speakNext() {
      if (sessionId !== systemPlaybackSession) return
      if (index >= sentences.length) {
        setIsSystemSpeaking(false)
        currentUtterance = null
        return
      }

      const sentenceText = sentences[index]
      options?.onSentenceStart?.(sentenceText, index, sentences.length)

      const utterance = new SpeechSynthesisUtterance(sentenceText)
      currentUtterance = utterance
      utterance.rate = rate
      if (matchedVoice) {
        utterance.voice = matchedVoice
      }

      utterance.onend = () => {
        if (sessionId !== systemPlaybackSession) return
        index++
        speakNext()
      }

      utterance.onerror = (e) => {
        if (e.error === "canceled" || e.error === "interrupted") return
        if (sessionId !== systemPlaybackSession) return
        index++
        speakNext()
      }

      window.speechSynthesis.speak(utterance)
    }

    speakNext()
  }

  function speak(
    rawText: string,
    options?: {
      engine?: "kokoro" | "system"
      voice?: string
      speed?: number
      onSentenceStart?: (sentence: string, index: number, total: number) => void
    },
  ) {
    stop()
    const engine = options?.engine ?? "system"

    if (engine === "kokoro") {
      void speakWithKokoro(rawText, {
        voice: options?.voice || "af_heart",
        speed: options?.speed ?? 1.0,
        onSentenceStart: options?.onSentenceStart,
      })
    } else {
      speakSystem(rawText, options)
    }
  }

  const isSpeaking = () => kokoro.isSpeaking() || isSystemSpeaking()

  if (typeof window !== "undefined") {
    ;(window as any).__whis_tts = {
      speak: (text: string) => {
        const eng = (typeof localStorage !== "undefined" ? (localStorage.getItem("whis_engine") ?? "system") : "system") as "kokoro" | "system"
        const v =
          eng === "kokoro"
            ? (typeof localStorage !== "undefined" ? (localStorage.getItem("whis_kokoro_voice") ?? "af_heart") : "af_heart")
            : (typeof localStorage !== "undefined" ? (localStorage.getItem("whis_voice") ?? "") : "")
        const s = typeof localStorage !== "undefined" && localStorage.getItem("whis_speed") ? parseFloat(localStorage.getItem("whis_speed")!) : 1.0
        speak(text, { engine: eng, voice: v, speed: s })
      },
      stop,
      isSpeaking,
    }
  }

  return {
    isSpeaking,
    kokoro,
    availableVoices: availableSystemVoices,
    kokoroVoices: KOKORO_VOICES,
    speak,
    stop,
  }
}
