import { Component, Show, createSignal, onMount, onCleanup, createEffect } from "solid-js"
import { IconButton } from "@opencode/ui/icon-button"
import { Icon } from "@opencode/ui/icon"
import { Tooltip } from "@opencode/ui/tooltip"
import { useSpeechToText } from "@/runtime/speech/stt"
import { useSettings } from "@/settings/model"
import { useWakeWordEngine } from "@/runtime/speech/wake-word-engine"
import type { ComposerEditorModel } from "./interaction"

export const ComposerVoiceInputButton: Component<{
  editor: () => HTMLDivElement | undefined
  controller?: ComposerEditorModel
  onSubmit: () => void
  disabled?: boolean
}> = (props) => {
  const stt = useSpeechToText()
  const settings = useSettings()
  const wakeWord = useWakeWordEngine()
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
      silenceThresholdSeconds: settings.voice.silenceThreshold(),
      whisperModel: settings.voice.whisperModel() as any,
      autoSendEnabled: settings.voice.autoSend(),
      getEditorText: () => props.editor()?.innerText ?? "",
      onTranscript: (chunk) => {
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
          props.controller.onInput(currentText, [{ type: "text", content: currentText, start: 0, end: currentText.length }], currentText.length)
        }
      },
      onAutoSend: () => {
        showTemporaryFeedback("Sending...")
        const el = props.editor()
        const text = el?.innerText?.trim() ?? ""
        if (text.length > 0) {
          if (props.controller) {
            props.controller.onInput(text, [{ type: "text", content: text, start: 0, end: text.length }], text.length)
          }
          if (el) {
            el.dispatchEvent(new Event("input", { bubbles: true }))
            el.dispatchEvent(new Event("change", { bubbles: true }))
          }
          setTimeout(() => {
            props.onSubmit()
          }, 50)
        }
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

  // Wake Word ("Hey Whis") integration
  createEffect(() => {
    const isWakeEnabled = settings.voice.wakeWordEnabled()
    const sensitivity = settings.voice.wakeWordSensitivity()

    if (isWakeEnabled) {
      wakeWord.start({
        sensitivity,
        onWakeWord: () => {
          showTemporaryFeedback("Hey Whis heard!")
          if (!stt.isListening()) {
            startListening()
          }
        },
      })
    } else {
      wakeWord.stop()
    }
  })

  onCleanup(() => {
    wakeWord.stop()
    stt.stop()
  })

  const tooltipText = () => {
    if (feedback()) return feedback()!
    if (stt.error()) return stt.error()!
    if (stt.status() === "transcribing") return "Transcribing with local Whisper..."
    if (stt.status() === "sending") return "Auto-sending prompt..."
    if (stt.status() === "speech_detected") return "Listening to speech (VAD Active)..."
    if (stt.isListening()) return `Listening... (Auto-sends after ${settings.voice.silenceThreshold()}s pause)`
    return "Local Voice Input (Silero VAD + Whisper \u00B7 Auto-send)"
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

          {/* Wake Word active badge indicator */}
          <Show when={settings.voice.wakeWordEnabled() && !stt.isListening()}>
            <span
              class="absolute -bottom-1 left-1.5 w-1.5 h-1.5 rounded-full bg-[#10b981] ring-1 ring-[#080502]"
              title="Wake word active ('Hey Whis')"
            />
          </Show>
        </div>
      </Tooltip>
    </Show>
  )
}
