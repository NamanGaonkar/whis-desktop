import { createSignal } from "solid-js"
import { normalizeForSpeech } from "./normalizer"
import { showToast } from "@/shell/notifications/toast"

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

let kokoroWorker: Worker | null = null
let workerInitPromise: Promise<void> | null = null
let activeAudioContext: AudioContext | null = null
let scheduledSourceNodes: AudioBufferSourceNode[] = []
let currentPlaybackSession = 0
let nextMessageId = 0
let nextScheduledAudioTime = 0
let hasNotifiedReady = false
const pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>()

function getWorker(): Worker {
  if (!kokoroWorker) {
    kokoroWorker = new Worker(new URL("./kokoro-worker.ts", import.meta.url), { type: "module" })

    kokoroWorker.onmessage = (e: MessageEvent) => {
      const data = e.data
      if (data.type === "status") {
        setStatus(data.status)
        if (data.message) setStatusMessage(data.message)
        if (data.status === "ready" && !hasNotifiedReady) {
          const isKokoro = typeof localStorage !== "undefined" && localStorage.getItem("whis_engine") === "kokoro"
          if (isKokoro) {
            hasNotifiedReady = true
            setTimeout(() => {
              showToast({
                title: "Kokoro Voice Ready",
                description: "Studio neural voice model is loaded and ready to talk.",
                variant: "success",
              })
            }, 800)
          }
        }
      } else if (data.type === "progress") {
        setDownloadProgress(data.progress)
        setStatusMessage(`Downloading Kokoro Model: ${data.progress}%`)
      } else if (data.id !== undefined && pendingRequests.has(data.id)) {
        const handler = pendingRequests.get(data.id)!
        pendingRequests.delete(data.id)
        if (data.type === "error") {
          handler.reject(new Error(data.error))
        } else {
          handler.resolve(data)
        }
      }
    }

    kokoroWorker.onerror = (err) => {
      console.warn("Kokoro worker error:", err)
      setStatus("error")
      setStatusMessage("Kokoro background worker crashed")
    }
  }
  return kokoroWorker
}

export async function initKokoroWorker(): Promise<void> {
  if (status() === "ready") return
  if (workerInitPromise) return workerInitPromise

  workerInitPromise = new Promise((resolve, reject) => {
    const worker = getWorker()
    setStatus("loading")
    setStatusMessage("Initializing Kokoro background worker...")

    const checkInterval = setInterval(() => {
      if (status() === "ready") {
        clearInterval(checkInterval)
        resolve()
      } else if (status() === "error") {
        clearInterval(checkInterval)
        reject(new Error(statusMessage()))
      }
    }, 100)

    worker.postMessage({ type: "init" })
  })

  return workerInitPromise
}

export function preloadKokoroEngine(): void {
  if (status() === "ready" || status() === "loading") return
  void initKokoroWorker().catch((err) => {
    console.warn("Kokoro background preload warning:", err)
  })
}

export function unloadKokoroEngine(): void {
  stopKokoroSpeech()
  if (kokoroWorker) {
    try {
      kokoroWorker.terminate()
    } catch {}
    kokoroWorker = null
  }
  workerInitPromise = null
  pendingRequests.clear()
  hasNotifiedReady = false
  setStatus("unloaded")
  setDownloadProgress(0)
  setStatusMessage("")
}

export function chunkTextForStreaming(text: string): string[] {
  if (!text) return []

  // Split on sentence boundaries: . ! ? followed by space or capital letter/number
  const rawSentences = text
    .replace(/([.!?])\s*(?=[A-Z0-9])/g, "$1|SPLIT|")
    .replace(/\n+/g, "|SPLIT|")
    .split("|SPLIT|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (rawSentences.length === 0) return [text.trim()]

  // Never split on commas - splitting on commas creates fragmented ONNX calls with dead air!
  // Instead, combine very short clauses (< 35 chars) with the next sentence so the audio buffer
  // is long enough (2+ seconds) to completely overlap the background generation of the next chunk.
  const chunks: string[] = []
  let buffer = ""

  for (const s of rawSentences) {
    if (!buffer) {
      buffer = s
    } else if (buffer.length < 35 || buffer.length + s.length < 100) {
      buffer = `${buffer} ${s}`
    } else {
      chunks.push(buffer)
      buffer = s
    }
  }
  if (buffer) {
    chunks.push(buffer)
  }

  return chunks.length > 0 ? chunks : [text.trim()]
}

export function stopKokoroSpeech() {
  currentPlaybackSession++

  for (const node of scheduledSourceNodes) {
    try {
      node.stop()
      node.disconnect()
    } catch {}
  }
  scheduledSourceNodes = []

  if (activeAudioContext && activeAudioContext.state !== "closed") {
    try {
      void activeAudioContext.close()
    } catch {}
    activeAudioContext = null
  }

  nextScheduledAudioTime = 0
  setIsSpeaking(false)
}

function generateInWorker(text: string, voice: string): Promise<{ audio: Float32Array; samplingRate: number }> {
  return new Promise((resolve, reject) => {
    const worker = getWorker()
    const id = ++nextMessageId
    pendingRequests.set(id, { resolve, reject })
    worker.postMessage({ id, type: "generate", text, voice })
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

  const chunks = chunkTextForStreaming(clean)
  if (chunks.length === 0) return

  setIsSpeaking(true)

  try {
    await initKokoroWorker()
  } catch (err) {
    console.warn("Worker init failed:", err)
    setIsSpeaking(false)
    return
  }

  if (sessionId !== currentPlaybackSession) return

  const voiceName = options?.voice || "af_heart"
  const speed = Math.max(0.7, Math.min(1.8, options?.speed ?? 1.0))

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

  nextScheduledAudioTime = ctx.currentTime + 0.05

  try {
    // Pipeline generation: generate first chunk immediately
    let nextChunkPromise: Promise<{ audio: Float32Array; samplingRate: number }> | null = generateInWorker(
      chunks[0],
      voiceName,
    )

    for (let i = 0; i < chunks.length; i++) {
      if (sessionId !== currentPlaybackSession) break

      options?.onSentenceStart?.(chunks[i], i, chunks.length)

      const result = await nextChunkPromise
      if (sessionId !== currentPlaybackSession || !result?.audio) break

      // Trigger synthesis for next chunk in worker while current is scheduled
      if (i + 1 < chunks.length) {
        nextChunkPromise = generateInWorker(chunks[i + 1], voiceName)
      } else {
        nextChunkPromise = null
      }

      const rawSamples = result.audio
      const sampleRate = result.samplingRate || 24000

      if (rawSamples && rawSamples.length > 0) {
        const audioBuffer = ctx.createBuffer(1, rawSamples.length, sampleRate)
        audioBuffer.getChannelData(0).set(rawSamples)

        const source = ctx.createBufferSource()
        source.buffer = audioBuffer
        source.playbackRate.value = speed
        source.connect(ctx.destination)
        scheduledSourceNodes.push(source)

        // Web Audio hardware sample-accurate scheduling (0ms gap between sentences)
        const startTime = Math.max(ctx.currentTime + 0.01, nextScheduledAudioTime)
        source.start(startTime)

        const chunkDuration = audioBuffer.duration / speed
        nextScheduledAudioTime = startTime + chunkDuration

        // If this is the last chunk, schedule state cleanup when it finishes
        if (i === chunks.length - 1) {
          source.onended = () => {
            if (sessionId === currentPlaybackSession) {
              stopKokoroSpeech()
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("Kokoro speech generation failed:", err)
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
    init: initKokoroWorker,
    preload: preloadKokoroEngine,
    unload: unloadKokoroEngine,
    speak: speakWithKokoro,
    stop: stopKokoroSpeech,
  }
}
