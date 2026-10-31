import { pipeline } from "@huggingface/transformers"

let transcriberInstance: any = null
let currentModelId: string | null = null
let loadPromise: Promise<any> | null = null

async function getTranscriber(modelId: string = "onnx-community/whisper-tiny.en") {
  if (transcriberInstance && currentModelId === modelId) {
    return transcriberInstance
  }
  if (loadPromise && currentModelId === modelId) {
    return loadPromise
  }

  loadPromise = (async () => {
    self.postMessage({ type: "status", status: "loading", message: `Loading ${modelId}...` })

    const transcriber = await pipeline("automatic-speech-recognition", modelId, {
      dtype: "q8",
      device: "wasm",
      progress_callback: (p: any) => {
        if (p && typeof p.progress === "number") {
          self.postMessage({ type: "progress", progress: Math.round(p.progress) })
        }
      },
    })

    transcriberInstance = transcriber
    currentModelId = modelId
    self.postMessage({ type: "status", status: "ready", message: "Whisper Ready" })
    return transcriber
  })()

  return loadPromise
}

self.onmessage = async (e: MessageEvent) => {
  const { id, type, audio, modelId } = e.data

  if (type === "init") {
    try {
      await getTranscriber(modelId || "onnx-community/whisper-tiny.en")
    } catch (err: any) {
      self.postMessage({ type: "status", status: "error", error: err?.message || String(err) })
    }
    return
  }

  if (type === "transcribe") {
    try {
      const transcriber = await getTranscriber(modelId || "onnx-community/whisper-tiny.en")
      const result = await transcriber(audio)
      const text = typeof result?.text === "string" ? result.text.trim() : ""
      self.postMessage({ id, type: "transcript", text })
    } catch (err: any) {
      self.postMessage({ id, type: "error", error: err?.message || String(err) })
    }
  }
}
