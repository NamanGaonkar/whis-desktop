import { createSignal } from "solid-js"
import { normalizeForSpeech } from "./normalizer"

export interface VoiceOption {
  id: string
  name: string
  lang: string
  isNatural: boolean
}

const [isSpeaking, setIsSpeaking] = createSignal(false)
const [availableVoices, setAvailableVoices] = createSignal<VoiceOption[]>([])

let currentUtterance: SpeechSynthesisUtterance | null = null
let watchdogInterval: ReturnType<typeof setInterval> | null = null

function cleanVoiceName(rawName: string, lang: string): string {
  let name = rawName
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

function updateVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  const raw = window.speechSynthesis.getVoices()
  if (!raw || raw.length === 0) return

  const list: VoiceOption[] = raw.map((v) => ({
    id: v.name,
    name: cleanVoiceName(v.name, v.lang),
    lang: v.lang,
    isNatural: v.name.toLowerCase().includes("natural") || v.name.toLowerCase().includes("online"),
  }))

  // Prioritize English voices first, then natural/online, then alphabetical
  list.sort((a, b) => {
    const aEn = a.lang.toLowerCase().startsWith("en") ? 1 : 0
    const bEn = b.lang.toLowerCase().startsWith("en") ? 1 : 0
    if (aEn !== bEn) return bEn - aEn
    if (a.isNatural !== b.isNatural) return a.isNatural ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  setAvailableVoices(list)
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  updateVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    updateVoices()
  }
}

export function useTextToSpeech() {
  // Ensure voices are requested whenever hook is accessed
  if (availableVoices().length === 0) {
    updateVoices()
  }

  function stop() {
    if (watchdogInterval) {
      clearInterval(watchdogInterval)
      watchdogInterval = null
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    currentUtterance = null
    setIsSpeaking(false)
  }

  function speak(rawText: string, options?: { voice?: string; speed?: number }) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return

    stop()

    const text = normalizeForSpeech(rawText)
    if (!text.trim()) return

    const utterance = new SpeechSynthesisUtterance(text)
    currentUtterance = utterance

    const rate = options?.speed ?? 1.0
    utterance.rate = Math.max(0.5, Math.min(2.0, rate))

    const preferred =
      options?.voice ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("whis_voice") || undefined : undefined)
    const voices = window.speechSynthesis.getVoices()

    let matchedVoice: SpeechSynthesisVoice | undefined

    if (preferred && preferred.trim()) {
      const p = preferred.trim().toLowerCase()
      matchedVoice =
        voices.find((v) => v.name === preferred || v.voiceURI === preferred) ??
        voices.find((v) => v.name.toLowerCase() === p || v.voiceURI.toLowerCase() === p) ??
        voices.find((v) => v.name.toLowerCase().includes(p) || p.includes(v.name.toLowerCase()))
    }

    if (!matchedVoice && voices.length > 0) {
      // Pick first English voice or default
      matchedVoice =
        voices.find((v) => v.default) ??
        voices.find((v) => v.lang.toLowerCase().startsWith("en-us")) ??
        voices.find((v) => v.lang.toLowerCase().startsWith("en")) ??
        voices[0]
    }

    if (matchedVoice) {
      utterance.voice = matchedVoice
    }

    utterance.onstart = () => {
      setIsSpeaking(true)
      // Watchdog interval keeps speech synthesis alive on long text in Chromium/Electron
      if (watchdogInterval) clearInterval(watchdogInterval)
      watchdogInterval = setInterval(() => {
        if (typeof window !== "undefined" && window.speechSynthesis.speaking) {
          window.speechSynthesis.pause()
          window.speechSynthesis.resume()
        } else if (watchdogInterval) {
          clearInterval(watchdogInterval)
          watchdogInterval = null
        }
      }, 8000)
    }

    utterance.onend = () => {
      if (watchdogInterval) {
        clearInterval(watchdogInterval)
        watchdogInterval = null
      }
      if (currentUtterance === utterance) {
        currentUtterance = null
        setIsSpeaking(false)
      }
    }

    utterance.onerror = (e) => {
      console.warn("TTS utterance error:", e)
      if (watchdogInterval) {
        clearInterval(watchdogInterval)
        watchdogInterval = null
      }
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
