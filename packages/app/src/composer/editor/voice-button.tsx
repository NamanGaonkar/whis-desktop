import { Component, Show, createSignal, onMount, onCleanup } from "solid-js"
import { IconButton } from "@opencode/ui/icon-button"
import { Icon } from "@opencode/ui/icon"
import { Tooltip } from "@opencode/ui/tooltip"
import { useSpeechToText } from "@/runtime/speech/stt"
import { useSettings } from "@/settings/model"
import type { ComposerEditorModel } from "./interaction"

export const ComposerVoiceInputButton: Component<{
  editor: () => HTMLDivElement | undefined
  controller?: ComposerEditorModel
  onSubmit: () => void
  disabled?: boolean
}> = (props) => {
  const stt = useSpeechToText()
  const settings = useSettings()
  const [feedback, setFeedback] = createSignal<string | null>(null)

  function showTemporaryFeedback(text: string) {
    setFeedback(text)
    setTimeout(() => {
      setFeedback(null)
    }, 2500)
  }

  function startListening() {
    const editorEl = props.editor()
    if (editorEl) {
      editorEl.focus()
    }

    stt.start({
      engine: (settings.voice.sttEngine() ?? "windows") as any,
      silenceThresholdSeconds: settings.voice.silenceThreshold(),
      whisperModel: settings.voice.whisperModel() as any,
      autoSendEnabled: settings.voice.autoSend(),
      getEditorText: () => props.editor()?.innerText ?? "",
      onTranscript: (chunk) => {
        const textToInsert = chunk.trim()
        if (!textToInsert) return

        const el = props.editor()
        if (el) {
          el.focus()
          try {
            document.execCommand("insertText", false, textToInsert + " ")
          } catch {
            el.innerText = (el.innerText ? el.innerText + " " : "") + textToInsert
          }
          el.dispatchEvent(new Event("input", { bubbles: true }))
        }

        if (props.controller) {
          const currentText = el?.innerText?.trim() || textToInsert
          props.controller.onInput(
            currentText,
            [{ type: "text", content: currentText, start: 0, end: currentText.length }],
            currentText.length,
          )
        }
      },
      onAutoSend: (transcriptText) => {
        const el = props.editor()
        const currentEditorText = el?.innerText?.trim() || ""
        const finalPrompt = currentEditorText.length > 0 ? currentEditorText : (transcriptText ? transcriptText.trim() : "")
        if (finalPrompt.length === 0) return

        showTemporaryFeedback("Sending...")

        if (props.controller) {
          props.controller.onInput(
            finalPrompt,
            [{ type: "text", content: finalPrompt, start: 0, end: finalPrompt.length }],
            finalPrompt.length,
          )
        }
        if (el) {
          el.innerText = finalPrompt
          el.dispatchEvent(new Event("input", { bubbles: true }))
          el.dispatchEvent(new Event("change", { bubbles: true }))
        }

        props.onSubmit()
        stt.stop()
      },
    })
  }

  function toggleListening() {
    if (stt.isListening()) {
      stt.stop()
      return
    }
    startListening()
  }

  // Push-to-Talk hotkey integration from Electron main process
  onMount(() => {
    const electronVoice = typeof window !== "undefined" ? (window as any).electron?.voice : undefined
    let cleanupPTT: (() => void) | undefined

    if (electronVoice?.onPushToTalkTriggered) {
      cleanupPTT = electronVoice.onPushToTalkTriggered(() => {
        toggleListening()
      })
      electronVoice.setPushToTalkHotkey(settings.voice.pushToTalkHotkey())
    }

    onCleanup(() => {
      cleanupPTT?.()
    })
  })

  onCleanup(() => {
    stt.stop()
  })

  const tooltipText = () => {
    if (feedback()) return feedback()!
    if (stt.error()) return stt.error()!
    if (stt.status() === "transcribing") return "Transcribing speech..."
    if (stt.status() === "sending") return "Auto-sending prompt..."
    if (stt.isListening()) return `Listening... (Auto-sends after ${settings.voice.silenceThreshold()}s pause)`
    return settings.voice.sttEngine() === "windows"
      ? "Voice Typing (Windows Win+H \u00B7 Auto-send)"
      : "Voice Input (Local Whisper \u00B7 Auto-send)"
  }

  return (
    <Show when={stt.isSupported}>
      <Tooltip placement="top" value={tooltipText()}>
        <div class="relative flex items-center">
          <IconButton
            data-action="composer-voice-input"
            type="button"
            disabled={props.disabled}
            icon={
              <div class="relative flex items-center justify-center">
                <Show when={stt.status() === "transcribing"}>
                  <div class="w-4 h-4 border-2 border-[#e5a93c] border-t-transparent rounded-full animate-spin" />
                </Show>
                <Show when={stt.status() !== "transcribing"}>
                  <Icon name="microphone" />
                  <Show when={stt.isListening()}>
                    {/* Live input level dynamic halo */}
                    <span
                      class="absolute inset-0 rounded-full bg-[#e5a93c] pointer-events-none transition-transform duration-75"
                      style={{
                        transform: `scale(${1 + (stt.audioLevel() / 100) * 0.8})`,
                        opacity: Math.max(0.15, stt.audioLevel() / 100),
                      }}
                    />
                    <span class="absolute -top-1 -right-1 flex h-2 w-2">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e5a93c] opacity-75" />
                      <span class="relative inline-flex rounded-full h-2 w-2 bg-[#e5a93c]" />
                    </span>
                  </Show>
                </Show>
              </div>
            }
            variant={stt.isListening() ? "contrast" : "ghost-muted"}
            class="size-7 rounded-md p-[6px] me-1.5 transition-colors relative z-10"
            classList={{
              "text-[#e5a93c] hover:text-[#ffd166] bg-[#e5a93c]/15 ring-1 ring-[#e5a93c]/40": stt.isListening(),
              "text-[#ef4444] bg-[#ef4444]/15 ring-1 ring-[#ef4444]/40": Boolean(stt.error()),
            }}
            aria-label={stt.isListening() ? "Stop listening" : "Start voice input"}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              toggleListening()
            }}
          />
        </div>
      </Tooltip>
    </Show>
  )
}
