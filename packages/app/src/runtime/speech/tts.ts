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

function cleanVoiceName(rawName: string, lang: string): string {
  const name = rawName
    .replace(/^Microsoft\s+/i, "")
    .replace(/^Google\s+/i, "")
    .replace(/\s+-\s+English\s+\(United States\)/i, "")
    .replace(/\s+-\s+English\s+\(United Kingdom\)/i, " (UK)")
    .replace(/\s+-\s+English\s+\(India\)/i, " (India)")
    .replace(/\s+-\s+English\s+\(Australia\)/i, " (AU)")
    .replace(/\s+Online\s+\(Natural\)/i, " (Natural)")

  const langTag = lang ? ` [${lang}]` : ""
  return `${name}${langTag}`
}

function updateSystemVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  const raw = window.speechSynthesis.getVoices()
  if (!raw || raw.length === 0) return

  const list: VoiceOption[] = raw.map((v) => ({
    id: v.name,
    name: cleanVoiceName(v.name, v.lang),
    lang: v.lang,
    isNatural: v.name.toLowerCase().includes("natural") || v.name.toLowerCase().includes("online"),
  }))

  list.sort((a, b) => {
    const aEn = a.lang.toLowerCase().startsWith("en") ? 1 : 0
    const bEn = b.lang.toLowerCase().startsWith("en") ? 1 : 0
    if (aEn !== bEn) return bEn - aEn
    if (a.isNatural !== b.isNatural) return a.isNatural ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  setAvailableSystemVoices(list)
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  updateSystemVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    updateSystemVoices()
  }
}

export function useTextToSpeech() {
  const kokoro = useKokoroEngine()

  if (availableSystemVoices().length === 0) {
    updateSystemVoices()
  }

  function stop() {
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

  function speakSystem(rawText: string, options?: { voice?: string; speed?: number }) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return

    const text = normalizeForSpeech(rawText)
    if (!text.trim()) return

    const utterance = new SpeechSynthesisUtterance(text)
    currentUtterance = utterance
    const rate = options?.speed ?? 1.0
    utterance.rate = Math.max(0.5, Math.min(2.0, rate))

    const preferred = options?.voice
    const voices = window.speechSynthesis.getVoices()

    let matchedVoice: SpeechSynthesisVoice | undefined
    if (preferred && preferred.trim()) {
      matchedVoice = voices.find((v) => v.name === preferred)
      if (!matchedVoice) {
        const lowerPref = preferred.toLowerCase()
        matchedVoice = voices.find((v) => v.name.toLowerCase().includes(lowerPref))
      }
    }
    if (!matchedVoice) {
      matchedVoice =
        voices.find((v) => v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Online"))) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices[0]
    }

    if (matchedVoice) {
      utterance.voice = matchedVoice
    }

    utterance.onstart = () => setIsSystemSpeaking(true)
    utterance.onend = () => {
      setIsSystemSpeaking(false)
      currentUtterance = null
    }
    utterance.onerror = () => {
      setIsSystemSpeaking(false)
      currentUtterance = null
    }

    window.speechSynthesis.speak(utterance)
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
    const engine = options?.engine ?? "kokoro"

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
        const eng = (typeof localStorage !== "undefined" ? (localStorage.getItem("whis_engine") ?? "kokoro") : "kokoro") as "kokoro" | "system"
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
