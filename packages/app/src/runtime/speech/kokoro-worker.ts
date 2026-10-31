import { KokoroTTS } from "kokoro-js"
import { env } from "@huggingface/transformers"

// Ensure browser CacheStorage persists models locally and never re-downloads
if (env) {
  env.useBrowserCache = true
  env.allowLocalModels = false
}

let ttsInstance: any = null
let modelPromise: Promise<any> | null = null

async function getTTS() {
  if (ttsInstance) return ttsInstance
  if (modelPromise) return modelPromise

  modelPromise = (async () => {
    self.postMessage({ type: "status", status: "loading", message: "Loading Kokoro Neural TTS..." })

    const modelId = "onnx-community/Kokoro-82M-v1.0-ONNX"

    // Consistently use dtype: "q8" (quantized 8-bit ~86MB) so it persists in browser cache
    // and never triggers re-downloading a 320MB fp32 model every restart.
    let tts: any = null
    const hasGpu = typeof navigator !== "undefined" && Boolean((navigator as any).gpu)

    if (hasGpu) {
      try {
        tts = await KokoroTTS.from_pretrained(modelId, {
          dtype: "q8",
          device: "webgpu",
          progress_callback: (p: any) => {
            if (p && typeof p.progress === "number") {
              self.postMessage({ type: "progress", progress: Math.round(p.progress) })
            }
          },
        })
      } catch (gpuErr) {
        console.warn("WebGPU initialization failed for Kokoro, falling back to wasm:", gpuErr)
        tts = null
      }
    }

    if (!tts) {
      tts = await KokoroTTS.from_pretrained(modelId, {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p: any) => {
          if (p && typeof p.progress === "number") {
            self.postMessage({ type: "progress", progress: Math.round(p.progress) })
          }
        },
      })
    }

    ttsInstance = tts
    self.postMessage({ type: "status", status: "ready", message: "Kokoro Neural TTS Ready" })
    return tts
  })()

  return modelPromise
}

self.onmessage = async (e: MessageEvent) => {
  const { id, type, text, voice } = e.data

  if (type === "init") {
    try {
      await getTTS()
    } catch (err: any) {
      self.postMessage({ type: "status", status: "error", error: err?.message || String(err) })
    }
    return
  }

  if (type === "generate") {
    try {
      const cleanText = (text || "").trim()
      if (!cleanText) {
        self.postMessage({ id, type: "audio", audio: new Float32Array(0), samplingRate: 24000 })
        return
      }

      const tts = await getTTS()
      const result = await tts.generate(cleanText, { voice: voice || "af_heart" })
      const rawAudio: Float32Array = result.audio
      const samplingRate: number = result.sampling_rate || 24000

      // Clone to transfer ownership cleanly to main thread
      const bufferCopy = new Float32Array(rawAudio)
      self.postMessage(
        {
          id,
          type: "audio",
          audio: bufferCopy,
          samplingRate,
        },
        [bufferCopy.buffer],
      )
    } catch (err: any) {
      self.postMessage({ id, type: "error", error: err?.message || String(err) })
    }
  }
}
