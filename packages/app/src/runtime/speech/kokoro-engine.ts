import { createSignal } from "solid-js"
import { normalizeForSpeech } from "./normalizer"

export interface KokoroVoice {
  id: string
  name: string
  gender: "female" | "male"
  accent: "American" | "British"
  description: string
}

export const KOKORO_VOICES: KokoroVoice[] = [
  { id: "af_heart", name: "Heart", gender: "female", accent: "American", description: "Warm, natural, ElevenLabs-quality" },
  { id: "af_bella", name: "Bella", gender: "female", accent: "American", description: "Expressive & bright" },
  { id: "af_sarah", name: "Sarah", gender: "female", accent: "American", description: "Clear narrator" },
  { id: "af_nicole", name: "Nicole", gender: "female", accent: "American", description: "Soft & intimate" },
  { id: "af_sky", name: "Sky", gender: "female", accent: "American", description: "Lively & energetic" },
  { id: "am_adam", name: "Adam", gender: "male", accent: "American", description: "Deep classic narrator" },
  { id: "am_michael", name: "Michael", gender: "male", accent: "American", description: "Conversational & natural" },
  { id: "am_echo", name: "Echo", gender: "male", accent: "American", description: "Dynamic & clear" },
  { id: "am_eric", name: "Eric", gender: "male", accent: "American", description: "Friendly & casual" },
  { id: "am_onyx", name: "Onyx", gender: "male", accent: "American", description: "Resonant & rich" },
  { id: "bf_emma", name: "Emma", gender: "female", accent: "British", description: "Classic British English" },
  { id: "bf_isabella", name: "Isabella", gender: "female", accent: "British", description: "Warm British English" },
  { id: "bm_george", name: "George", gender: "male", accent: "British", description: "Formal British narrator" },
  { id: "bm_lewis", name: "Lewis", gender: "male", accent: "British", description: "Casual British English" },
]

export type KokoroModelStatus = "unloaded" | "loading" | "ready" | "error"

const [status, setStatus] = createSignal<KokoroModelStatus>("unloaded")
const [downloadProgress, setDownloadProgress] = createSignal<number>(0)
const [statusMessage, setStatusMessage] = createSignal<string>("")
const [isSpeaking, setIsSpeaking] = createSignal<boolean>(false)

let kokoroTTSInstance: any = null
let initPromise: Promise<any> | null = null
let activeAudioContext: AudioContext | null = null
let activeSourceNode: AudioBufferSourceNode | null = null
let currentPlaybackSession = 0

export function splitIntoSentences(text: string): string[] {
  if (!text) return []
  // Matches full sentences ending in . ! ? or linebreaks
  const sentences = text
    .replace(/([.!?])\s*(?=[A-Z0-9])/g, "$1|SPLIT|")
    .replace(/\n+/g, "|SPLIT|")
    .split("|SPLIT|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  return sentences.length > 0 ? sentences : [text.trim()]
}

export async function getKokoroTTS() {
  if (kokoroTTSInstance) return kokoroTTSInstance
  if (initPromise) return initPromise

  initPromise = (async () => {
    setStatus("loading")
    setStatusMessage("Loading Kokoro Neural TTS...")
    setDownloadProgress(10)

    try {
      const { KokoroTTS } = await import("kokoro-js")
      const modelId = "onnx-community/Kokoro-82M-v1.0-ONNX"

      // Kokoro q8 quantization: optimal balance of human voice quality and fast CPU inference
      const tts = await KokoroTTS.from_pretrained(modelId, {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p: any) => {
          if (p && typeof p.progress === "number") {
            setDownloadProgress(Math.round(p.progress))
            setStatusMessage(`Downloading Kokoro Model: ${Math.round(p.progress)}%`)
          }
        },
      })

      kokoroTTSInstance = tts
      setStatus("ready")
      setDownloadProgress(100)
      setStatusMessage("Kokoro Neural TTS Ready")
      return tts
    } catch (err: any) {
      console.warn("Kokoro TTS init failed:", err)
      setStatus("error")
      setStatusMessage(err?.message || "Failed to load Kokoro TTS")
      initPromise = null
      throw err
    }
  })()

  return initPromise
}

export function stopKokoroSpeech() {
  currentPlaybackSession++
  if (activeSourceNode) {
    try {
      activeSourceNode.stop()
      activeSourceNode.disconnect()
    } catch {}
    activeSourceNode = null
  }
  if (activeAudioContext && activeAudioContext.state !== "closed") {
    try {
      void activeAudioContext.close()
    } catch {}
    activeAudioContext = null
  }
  setIsSpeaking(false)
}

function playAudioBuffer(ctx: AudioContext, audioBuffer: AudioBuffer, speed: number = 1.0): Promise<void> {
  return new Promise((resolve) => {
    try {
      const source = ctx.createBufferSource()
      activeSourceNode = source
      source.buffer = audioBuffer
      source.playbackRate.value = Math.max(0.7, Math.min(1.8, speed))
      source.connect(ctx.destination)

      source.onended = () => {
        if (activeSourceNode === source) {
          activeSourceNode = null
        }
        resolve()
      }

      source.start(0)
    } catch {
      resolve()
    }
  })
}

export async function speakWithKokoro(
  rawText: string,
  options?: {
    voice?: string
    speed?: number
    onSentenceStart?: (sentence: string, index: number, total: number) => void
  },
): Promise<void> {
  stopKokoroSpeech()
  const sessionId = ++currentPlaybackSession

  const clean = normalizeForSpeech(rawText)
  if (!clean.trim()) return

  const sentences = splitIntoSentences(clean)
  if (sentences.length === 0) return

  setIsSpeaking(true)

  let tts: any
  try {
    tts = await getKokoroTTS()
  } catch {
    setIsSpeaking(false)
    return
  }

  if (sessionId !== currentPlaybackSession) return

  const voiceName = options?.voice || "af_heart"
  const speed = options?.speed ?? 1.0

  // Set up Web Audio Context
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioCtx) {
    setIsSpeaking(false)
    return
  }
  const ctx = new AudioCtx()
  activeAudioContext = ctx
  if (ctx.state === "suspended") {
    await ctx.resume()
  }

  try {
    // Sentence-by-sentence streaming:
    // Generate the next sentence in parallel while the current sentence is speaking
    let nextAudioPromise: Promise<any> | null = tts.generate(sentences[0], { voice: voiceName })

    for (let i = 0; i < sentences.length; i++) {
      if (sessionId !== currentPlaybackSession) break

      options?.onSentenceStart?.(sentences[i], i, sentences.length)

      const currentAudio = await nextAudioPromise
      if (sessionId !== currentPlaybackSession || !currentAudio) break

      // Start generating the next sentence while this one plays
      if (i + 1 < sentences.length) {
        nextAudioPromise = tts.generate(sentences[i + 1], { voice: voiceName })
      } else {
        nextAudioPromise = null
      }

      // Convert Float32Array into AudioBuffer
      const rawSamples = currentAudio.audio
      const sampleRate = currentAudio.sampling_rate || 24000

      if (rawSamples && rawSamples.length > 0) {
        const audioBuffer = ctx.createBuffer(1, rawSamples.length, sampleRate)
        audioBuffer.copyToChannel(rawSamples, 0)
        await playAudioBuffer(ctx, audioBuffer, speed)
      }
    }
  } catch (err) {
    console.warn("Kokoro speech generation error:", err)
  } finally {
    if (sessionId === currentPlaybackSession) {
      stopKokoroSpeech()
    }
  }
}

export function useKokoroEngine() {
  return {
    status,
    downloadProgress,
    statusMessage,
    isSpeaking,
    voices: KOKORO_VOICES,
    init: getKokoroTTS,
    speak: speakWithKokoro,
    stop: stopKokoroSpeech,
  }
}
