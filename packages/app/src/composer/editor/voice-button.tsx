import { Component, Show, createSignal } from "solid-js"
import { IconButton } from "@opencode/ui/icon-button"
import { Icon } from "@opencode/ui/icon"
import { Tooltip } from "@opencode/ui/tooltip"
import { useSpeechToText } from "@/runtime/speech/stt"
import { useSettings } from "@/settings/model"
import { parseVoiceInput } from "@/runtime/speech/commands"

export const ComposerVoiceInputButton: Component<{
  editor: () => HTMLDivElement | undefined
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

    // Ensure editor is focused before starting so dictation targets the active prompt
    const el = props.editor()
    if (el) {
      el.focus()
    }

    stt.start({
      autoSendEnabled: settings.voice.autoSend(),
      onTranscript: (chunk, isFinal) => {
        if (!isFinal) return

        const action = parseVoiceInput(chunk)

        if (action.type === "command") {
          switch (action.command) {
            case "submit":
              showTemporaryFeedback("Sending prompt...")
              props.onSubmit()
              break

            case "clear":
              showTemporaryFeedback("Input cleared")
              const clearEl = props.editor()
              if (clearEl) {
                clearEl.focus()
                document.execCommand("selectAll", false)
                document.execCommand("delete", false)
              }
              break

            case "stop":
              showTemporaryFeedback("Voice stopped")
              stt.stop()
              break

            case "show-graph":
            case "show-chat":
            case "new-session":
              showTemporaryFeedback(`Command: ${action.command.replace("-", " ")}`)
              window.dispatchEvent(new CustomEvent("whis:command", { detail: { command: action.command } }))
              break
          }
          return
        }

        if (action.type === "wake-word-only") {
          showTemporaryFeedback("Whis awake, listening...")
          const editorEl = props.editor()
          editorEl?.focus()
          return
        }

        // Standard dictation
        const editorEl = props.editor()
        if (!editorEl) return
        editorEl.focus()
        const text = action.text.trim() + " "
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
        value={
          feedback() ??
          stt.error() ??
          (stt.isListening()
            ? 'Whis is listening... (Say "Hey Whis", commands like "show graph", "clear", "send", or pause to auto-send)'
            : 'Voice Input (Click to speak \u00B7 Wake word "Hey Whis" & commands supported)')
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
            "text-[#e5a93c] hover:text-[#ffd166] bg-[#e5a93c]/15": stt.isListening(),
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
