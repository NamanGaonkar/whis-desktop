import { Component, Show, createSignal } from "solid-js"
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

  function toggleListening() {
    if (stt.isListening()) {
      stt.stop()
      return
    }

    const editorEl = props.editor()
    if (editorEl) {
      editorEl.focus()
    }

    stt.start({
      autoSendEnabled: settings.voice.autoSend(),
      getEditorText: () => props.editor()?.innerText ?? "",
      onTranscript: (chunk, isFinal) => {
        if (!isFinal) return

        const el = props.editor()
        if (!el) return
        el.focus()
        // Insert text cleanly into the contenteditable editor
        const textToInsert = chunk.trim() + " "
        try {
          document.execCommand("insertText", false, textToInsert)
        } catch {}
        el.dispatchEvent(new Event("input", { bubbles: true }))

        // Ensure controller state is updated
        if (props.controller) {
          const currentText = el.innerText.trim()
          props.controller.onInput(currentText, [{ type: "text", content: currentText }], currentText.length)
        }
      },
      onAutoSend: () => {
        showTemporaryFeedback("Auto-sending...")
        const el = props.editor()
        const text = el?.innerText?.trim() ?? ""
        if (text.length > 0) {
          if (props.controller) {
            props.controller.onInput(text, [{ type: "text", content: text }], text.length)
          }
          if (el) {
            el.dispatchEvent(new Event("input", { bubbles: true }))
            el.dispatchEvent(new Event("change", { bubbles: true }))
          }
          setTimeout(() => {
            props.onSubmit()
          }, 40)
        }
      },
    })
  }

  return (
    <Show when={stt.isSupported}>
      <Tooltip
        placement="top"
        value={
          feedback() ??
          stt.error() ??
          (stt.isListening()
            ? "Listening... (Will automatically send as soon as you finish speaking)"
            : "Voice Input (Click to speak \u00B7 Auto-sends on pause)")
        }
      >
        <IconButton
          data-action="composer-voice-input"
          type="button"
          disabled={props.disabled}
          icon={
            <div class="relative flex items-center justify-center">
              <Icon name="microphone" />
              <Show when={stt.isListening()}>
                <span class="absolute -top-1 -right-1 flex h-2 w-2">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e5a93c] opacity-75" />
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-[#e5a93c]" />
                </span>
              </Show>
            </div>
          }
          variant={stt.isListening() ? "contrast" : "ghost-muted"}
          class="size-7 rounded-md p-[6px] me-1.5 transition-colors"
          classList={{
            "text-[#e5a93c] hover:text-[#ffd166] bg-[#e5a93c]/15 ring-1 ring-[#e5a93c]/40": stt.isListening(),
          }}
          aria-label={stt.isListening() ? "Stop listening" : "Start voice input"}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            toggleListening()
          }}
        />
      </Tooltip>
    </Show>
  )
}
