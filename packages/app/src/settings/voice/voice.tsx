import { Component, createMemo } from "solid-js"
import { Select } from "@opencode/ui/select"
import { Switch } from "@opencode/ui/switch"
import { Button } from "@opencode/ui/button"
import { Icon } from "@opencode/ui/icon"
import { useLanguage } from "@/runtime/i18n/language"
import { SettingsList } from "@/settings/list"
import { SettingsRow } from "@/settings/row"
import { useSettings } from "@/settings/model"
import { useTextToSpeech, type VoiceOption } from "@/runtime/speech/tts"
import "@/settings/settings.css"

const speedOptions = [
  { value: 0.8, label: "0.8x (Relaxed)" },
  { value: 1.0, label: "1.0x (Normal)" },
  { value: 1.2, label: "1.2x (Fast)" },
  { value: 1.5, label: "1.5x (Speedy)" },
]

export const SettingsVoice: Component = () => {
  const language = useLanguage()
  const settings = useSettings()
  const tts = useTextToSpeech()

  const voiceOptions = createMemo((): VoiceOption[] => {
    const list = tts.availableVoices()
    if (list.length > 0) return list
    return [{ id: "", name: "Default System Voice", lang: "en", isNatural: false }]
  })

  const selectedVoice = createMemo(() => {
    const currentId = settings.voice.voice()
    const options = voiceOptions()
    if (!currentId) return options[0]
    return options.find((opt) => opt.id === currentId) ?? options[0]
  })

  function handleTestVoice() {
    if (tts.isSpeaking()) {
      tts.stop()
      return
    }
    tts.speak(
      "Hello! I am Whis, your autonomous coding assistant. Voice synthesis is working smoothly and naturally.",
      {
        voice: settings.voice.voice(),
        speed: settings.voice.speed(),
      },
    )
  }

  return (
    <div class="settings-tab-body settings-tab-body--sectioned">
      <section class="settings-section" aria-label={language.t("settings.voice.section.output")}>
        <h3 class="settings-section-title">{language.t("settings.voice.section.output")}</h3>
        <SettingsList>
          <SettingsRow
            title={language.t("settings.voice.autoSpeak.title")}
            description={language.t("settings.voice.autoSpeak.description")}
          >
            <div data-action="settings-voice-autospeak">
              <Switch
                checked={settings.voice.autoSpeak()}
                onChange={(checked) => settings.voice.setAutoSpeak(checked)}
              />
            </div>
          </SettingsRow>

          <SettingsRow
            title={language.t("settings.voice.voiceSelect.title")}
            description={language.t("settings.voice.voiceSelect.description")}
          >
            <div class="flex items-center gap-2">
              <Select
                data-action="settings-voice-select"
                options={voiceOptions()}
                current={selectedVoice()}
                value={(opt) => opt.id}
                label={(opt) => opt.name}
                placement="bottom-end"
                gutter={6}
                onSelect={(opt) => {
                  if (opt) {
                    settings.voice.setVoice(opt.id)
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="small"
                class="gap-1.5 shrink-0"
                onClick={handleTestVoice}
              >
                <Icon name={tts.isSpeaking() ? "stop" : "volume"} size="small" />
                <span>{tts.isSpeaking() ? "Stop" : language.t("settings.voice.preview")}</span>
              </Button>
            </div>
          </SettingsRow>

          <SettingsRow
            title={language.t("settings.voice.speed.title")}
            description={language.t("settings.voice.speed.description")}
          >
            <Select
              data-action="settings-voice-speed"
              options={speedOptions}
              current={speedOptions.find((opt) => Math.abs(opt.value - settings.voice.speed()) < 0.05) ?? speedOptions[1]}
              value={(opt) => String(opt.value)}
              label={(opt) => opt.label}
              placement="bottom-end"
              gutter={6}
              onSelect={(opt) => opt && settings.voice.setSpeed(opt.value)}
            />
          </SettingsRow>
        </SettingsList>
      </section>

      <section class="settings-section" aria-label={language.t("settings.voice.section.input")}>
        <h3 class="settings-section-title">{language.t("settings.voice.section.input")}</h3>
        <SettingsList>
          <SettingsRow
            title={language.t("settings.voice.autoSend.title")}
            description={language.t("settings.voice.autoSend.description")}
          >
            <div data-action="settings-voice-autosend">
              <Switch
                checked={settings.voice.autoSend()}
                onChange={(checked) => settings.voice.setAutoSend(checked)}
              />
            </div>
          </SettingsRow>
        </SettingsList>
      </section>
    </div>
  )
}
