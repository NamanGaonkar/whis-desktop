import { createSignal } from "solid-js"

export type WhisperModelSize = "tiny.en" | "base" | "small"

export interface WhisperModelOption {
  id: WhisperModelSize
  name: string
  modelId: string
  size: string
  description: string
}

export const WHISPER_MODELS: WhisperModelOption[] = [
  {
    id: "tiny.en",
    name: "Whisper Tiny English (Ultra Fast - Recommended)",
    modelId: "onnx-community/whisper-tiny.en",
    size: "~39 MB",
    description: "Ultra-fast ~200ms transcription, minimal resource usage",
  },
  {
    id: "base",
    name: "Whisper Base (Standard)",
    modelId: "onnx-community/whisper-base",
    size: "~73 MB",
    description: "Balanced general accuracy and transcription speed",
  },
  {
    id: "small",
    name: "Whisper Small (High Accuracy)",
    modelId: "onnx-community/whisper-small",
    size: "~240 MB",
    description: "Maximum accuracy for dense technical code and jargon",
  },
]

export type WhisperStatus = "unloaded" | "loading" | "ready" | "transcribing" | "error"

const [status, setStatus] = createSignal<WhisperStatus>("unloaded")
const [downloadProgress, setDownloadProgress] = createSignal<number>(0)
const [statusMessage, setStatusMessage] = createSignal<string>("")
const [currentModel, setCurrentModel] = createSignal<WhisperModelSize>("tiny.en")

let whisperWorker: Worker | null = null
let workerInitPromise: Promise<void> | null = null
let nextMessageId = 0
const pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>()

function getWorker(): Worker {
  if (!whisperWorker) {
    whisperWorker = new Worker(new URL("./whisper-worker.ts", import.meta.url), { type: "module" })

    whisperWorker.onmessage = (e: MessageEvent) => {
      const data = e.data
      if (data.type === "status") {
        setStatus(data.status)
        if (data.message) setStatusMessage(data.message)
      } else if (data.type === "progress") {
        setDownloadProgress(data.progress)
        setStatusMessage(`Downloading Whisper: ${data.progress}%`)
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

    whisperWorker.onerror = (err) => {
      console.warn("Whisper worker error:", err)
      setStatus("error")
      setStatusMessage("Whisper background worker crashed")
    }
  }
  return whisperWorker
}

export async function initWhisperWorker(modelSize: WhisperModelSize = "tiny.en"): Promise<void> {
  const targetOption = WHISPER_MODELS.find((m) => m.id === modelSize) ?? WHISPER_MODELS[0]
  if (status() === "ready" && currentModel() === modelSize) return

  workerInitPromise = new Promise((resolve, reject) => {
    const worker = getWorker()
    setStatus("loading")
    setStatusMessage(`Loading ${targetOption.name}...`)

    const checkInterval = setInterval(() => {
      if (status() === "ready") {
        clearInterval(checkInterval)
        setCurrentModel(modelSize)
        resolve()
      } else if (status() === "error") {
        clearInterval(checkInterval)
        reject(new Error(statusMessage()))
      }
    }, 100)

    worker.postMessage({ type: "init", modelId: targetOption.modelId })
  })

  return workerInitPromise
}

export async function transcribeAudioWithWhisper(
  audioData: Float32Array,
  modelSize: WhisperModelSize = "tiny.en",
): Promise<string> {
  if (!audioData || audioData.length === 0) return ""

  setStatus("transcribing")
  setStatusMessage("Transcribing in background worker...")

  try {
    const targetOption = WHISPER_MODELS.find((m) => m.id === modelSize) ?? WHISPER_MODELS[0]
    await initWhisperWorker(modelSize)

    const worker = getWorker()
    const id = ++nextMessageId

    // Copy audio buffer to transfer safely
    const copy = new Float32Array(audioData)

    const result = await new Promise<{ text: string }>((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject })
      worker.postMessage(
        {
          id,
          type: "transcribe",
          audio: copy,
          modelId: targetOption.modelId,
        },
        [copy.buffer],
      )
    })

    setStatus("ready")
    setStatusMessage("Transcription complete")
    return typeof result?.text === "string" ? result.text.trim() : ""
  } catch (err: any) {
    console.warn("Whisper transcription failed in worker:", err)
    setStatus("ready")
    setStatusMessage("Transcription error")
    return ""
  }
}

export function useWhisperEngine() {
  return {
    status,
    downloadProgress,
    statusMessage,
    currentModel,
    models: WHISPER_MODELS,
    init: initWhisperWorker,
    transcribe: transcribeAudioWithWhisper,
  }
}
