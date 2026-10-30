import { Component, Show } from "solid-js"
import { IconButton } from "@opencode/ui/icon-button"
import { Icon } from "@opencode/ui/icon"
import { Tooltip } from "@opencode/ui/tooltip"
import { useSpeechToText } from "@/runtime/speech/stt"
import { useSettings } from "@/settings/model"

export const ComposerVoiceInputButton: Component<{
  editor: () => HTMLDivElement | undefined
  onSubmit: () => void
  disabled?: boolean
}> = (props) => {
  const stt = useSpeechToText()
  const settings = useSettings()

  function toggleListening() {
    if (stt.isListening()) {
      stt.stop()
      return
    }

    stt.start({
      autoSendEnabled: settings.voice.autoSend(),
      onTranscript: (chunk, isFinal) => {
        if (!isFinal) return
        const el = props.editor()
        if (!el) return
        el.focus()
        // Standard contenteditable text insertion preserves undo stack & triggers input listener
        const text = chunk.trim() + " "
        document.execCommand("insertText", false, text)
      },
      onAutoSend: () => {
        props.onSubmit()
      },
    })
  }

  return (
    <Show when={stt.isSupported}>
      <Tooltip
        placement="top"
        value={stt.isListening() ? "Listening... (Click to stop)" : "Voice Input (Click to speak)"}
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
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
              </Show>
            </div>
          }
          variant={stt.isListening() ? "contrast" : "ghost-muted"}
          class="size-7 rounded-md p-[6px] me-1.5 transition-colors"
          classList={{
            "text-red-500 hover:text-red-600 bg-red-500/10": stt.isListening(),
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
