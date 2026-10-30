import { createSignal } from "solid-js"
import { normalizeForSpeech } from "./normalizer"

export interface VoiceOption {
  id: string
  name: string
  lang: string
  isNatural: boolean
}

export const PRESET_VOICES: { id: string; name: string; match: string }[] = [
  { id: "en-US-ChristopherNeural", name: "Christopher (Natural US Male)", match: "Christopher" },
  { id: "en-US-JennyNeural", name: "Jenny (Natural US Female)", match: "Jenny" },
  { id: "en-US-GuyNeural", name: "Guy (Natural US Male)", match: "Guy" },
  { id: "en-US-EricNeural", name: "Eric (Natural US Male)", match: "Eric" },
  { id: "en-US-AriaNeural", name: "Aria (Natural US Female)", match: "Aria" },
  { id: "system-default", name: "System Default Voice", match: "" },
]

const [isSpeaking, setIsSpeaking] = createSignal(false)
const [availableVoices, setAvailableVoices] = createSignal<VoiceOption[]>([])

let currentUtterance: SpeechSynthesisUtterance | null = null

function updateVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  const raw = window.speechSynthesis.getVoices()
  const options: VoiceOption[] = raw.map((v) => ({
    id: v.name,
    name: v.name,
    lang: v.lang,
    isNatural: v.name.toLowerCase().includes("natural") || v.name.toLowerCase().includes("neural"),
  }))
  setAvailableVoices(options)
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  updateVoices()
  window.speechSynthesis.onvoiceschanged = updateVoices
}

export function useTextToSpeech() {
  function stop() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    currentUtterance = null
    setIsSpeaking(false)
  }

  function speak(rawText: string, options?: { voice?: string; speed?: number }) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return

    stop()

    const text = normalizeForSpeech(rawText)
    if (!text) return

    const utterance = new SpeechSynthesisUtterance(text)
    currentUtterance = utterance

    const rate = options?.speed ?? 1.0
    utterance.rate = Math.max(0.5, Math.min(2.0, rate))

    const preferred = options?.voice ?? "en-US-ChristopherNeural"
    const voices = window.speechSynthesis.getVoices()

    let matchedVoice = voices.find((v) => v.name.includes(preferred))

    if (!matchedVoice) {
      // Find preset voice match
      const preset = PRESET_VOICES.find((p) => p.id === preferred)
      if (preset && preset.match) {
        matchedVoice = voices.find((v) => v.name.toLowerCase().includes(preset.match.toLowerCase()))
      }
    }

    if (!matchedVoice) {
      // Fallback: pick any natural or English voice
      matchedVoice =
        voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.toLowerCase().includes("natural") || v.name.toLowerCase().includes("online")),
        ) ?? voices.find((v) => v.lang.startsWith("en"))
    }

    if (matchedVoice) {
      utterance.voice = matchedVoice
    }

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => {
      if (currentUtterance === utterance) {
        currentUtterance = null
        setIsSpeaking(false)
      }
    }
    utterance.onerror = () => {
      if (currentUtterance === utterance) {
        currentUtterance = null
        setIsSpeaking(false)
      }
    }

    window.speechSynthesis.speak(utterance)
  }

  return {
    isSpeaking,
    availableVoices,
    speak,
    stop,
  }
}
