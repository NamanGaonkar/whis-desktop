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
    id: "base",
    name: "Whisper Base (Recommended)",
    modelId: "onnx-community/whisper-base",
    size: "~73 MB",
    description: "Great balance of accuracy and transcription speed",
  },
  {
    id: "tiny.en",
    name: "Whisper Tiny English (Fastest)",
    modelId: "onnx-community/whisper-tiny.en",
    size: "~39 MB",
    description: "Ultra lightweight, minimal CPU usage",
  },
  {
    id: "small",
    name: "Whisper Small (High Accuracy)",
    modelId: "onnx-community/whisper-small",
    size: "~240 MB",
    description: "Maximum recognition accuracy for technical coding terms",
  },
]

export type WhisperStatus = "unloaded" | "loading" | "ready" | "transcribing" | "error"

const [status, setStatus] = createSignal<WhisperStatus>("unloaded")
const [downloadProgress, setDownloadProgress] = createSignal<number>(0)
const [statusMessage, setStatusMessage] = createSignal<string>("")
const [currentModel, setCurrentModel] = createSignal<WhisperModelSize>("base")

let transcriberInstance: any = null
let loadedModelId: string | null = null
let loadPromise: Promise<any> | null = null

export async function getWhisperTranscriber(modelSize: WhisperModelSize = "base") {
  const targetOption = WHISPER_MODELS.find((m) => m.id === modelSize) ?? WHISPER_MODELS[0]

  if (transcriberInstance && loadedModelId === targetOption.modelId) {
    return transcriberInstance
  }

  if (loadPromise && loadedModelId === targetOption.modelId) {
    return loadPromise
  }

  loadPromise = (async () => {
    setStatus("loading")
    setDownloadProgress(5)
    setStatusMessage(`Loading ${targetOption.name}...`)

    try {
      const { pipeline } = await import("@huggingface/transformers")

      const transcriber = await pipeline("automatic-speech-recognition", targetOption.modelId, {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p: any) => {
          if (p && typeof p.progress === "number") {
            setDownloadProgress(Math.round(p.progress))
            setStatusMessage(`Downloading Whisper (${targetOption.id}): ${Math.round(p.progress)}%`)
          }
        },
      })

      transcriberInstance = transcriber
      loadedModelId = targetOption.modelId
      setCurrentModel(modelSize)
      setStatus("ready")
      setDownloadProgress(100)
      setStatusMessage("Whisper Model Ready")
      return transcriber
    } catch (err: any) {
      console.warn("Whisper model loading failed:", err)
      setStatus("error")
      setStatusMessage(err?.message || "Failed to load Whisper model")
      loadPromise = null
      throw err
    }
  })()

  return loadPromise
}

export async function transcribeAudioWithWhisper(
  audioData: Float32Array,
  modelSize: WhisperModelSize = "base",
): Promise<string> {
  if (!audioData || audioData.length === 0) return ""

  setStatus("transcribing")
  setStatusMessage("Transcribing locally with Whisper...")

  try {
    const transcriber = await getWhisperTranscriber(modelSize)
    const result = await transcriber(audioData)

    setStatus("ready")
    setStatusMessage("Transcription complete")

    const text = typeof result?.text === "string" ? result.text.trim() : ""
    return text
  } catch (err: any) {
    console.warn("Whisper transcription failed:", err)
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
    init: getWhisperTranscriber,
    transcribe: transcribeAudioWithWhisper,
  }
}
