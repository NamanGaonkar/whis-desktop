import { Component, createMemo, Show } from "solid-js"
import { Select } from "@opencode/ui/select"
import { Switch } from "@opencode/ui/switch"
import { Button } from "@opencode/ui/button"
import { Icon } from "@opencode/ui/icon"
import { useLanguage } from "@/runtime/i18n/language"
import { SettingsList } from "@/settings/list"
import { SettingsRow } from "@/settings/row"
import { useSettings } from "@/settings/model"
import { useTextToSpeech, type VoiceOption } from "@/runtime/speech/tts"
import { useKokoroEngine, type KokoroVoice } from "@/runtime/speech/kokoro-engine"
import { useWhisperEngine, WHISPER_MODELS, type WhisperModelOption } from "@/runtime/speech/whisper-engine"
import "@/settings/settings.css"

const speedOptions = [
  { value: 0.8, label: "0.8x (Relaxed)" },
  { value: 1.0, label: "1.0x (Normal)" },
  { value: 1.2, label: "1.2x (Fast)" },
  { value: 1.5, label: "1.5x (Speedy)" },
]

const engineOptions = [
  { value: "kokoro", label: "Kokoro Neural Voice (Studio Human HD - Background Worker)" },
  { value: "system", label: "Fast Windows Voice (Instant 0ms, Zero Lag)" },
]

const sttEngineOptions = [
  { value: "windows", label: "Windows Native Voice Typing (Win + H - Instant 0ms, Streaming - Recommended)" },
  { value: "whisper", label: "Local Whisper Model (Offline Background Worker)" },
]

export const SettingsVoice: Component = () => {
  const language = useLanguage()
  const settings = useSettings()
  const tts = useTextToSpeech()
  const kokoro = useKokoroEngine()
  const whisper = useWhisperEngine()

  const systemVoiceOptions = createMemo((): VoiceOption[] => {
    const list = tts.availableVoices()
    if (list.length > 0) return list
    return [{ id: "", name: "Default System Voice", lang: "en", isNatural: false }]
  })

  const selectedEngine = createMemo(() => {
    const eng = settings.voice.engine()
    return engineOptions.find((e) => e.value === eng) ?? engineOptions[0]
  })

  const selectedSttEngine = createMemo(() => {
    const eng = settings.voice.sttEngine()
    return sttEngineOptions.find((e) => e.value === eng) ?? sttEngineOptions[0]
  })

  const selectedKokoroVoice = createMemo((): KokoroVoice => {
    const cur = settings.voice.kokoroVoice()
    return kokoro.voices.find((v) => v.id === cur) ?? kokoro.voices[0]!
  })

  const selectedSystemVoice = createMemo(() => {
    const currentId = settings.voice.voice()
    const options = systemVoiceOptions()
    if (!currentId) return options[0]
    return options.find((opt) => opt.id === currentId) ?? options[0]
  })

  const selectedWhisperModel = createMemo((): WhisperModelOption => {
    const cur = settings.voice.whisperModel()
    return WHISPER_MODELS.find((m) => m.id === cur) ?? WHISPER_MODELS[0]
  })

  function handleTestVoice() {
    if (tts.isSpeaking()) {
      tts.stop()
      return
    }

    const eng = settings.voice.engine() as "kokoro" | "system"
    tts.speak(
      "Hello! I am Whis, your AI pair programmer. Voice is working smoothly and naturally.",
      {
        engine: eng,
        voice: eng === "kokoro" ? settings.voice.kokoroVoice() : settings.voice.voice(),
        speed: settings.voice.speed(),
      },
    )
  }

  return (
    <div class="settings-tab-body settings-tab-body--sectioned">
      {/* 1. Speech Output (TTS) */}
      <section class="settings-section" aria-label="Speech Output (Neural TTS)">
        <h3 class="settings-section-title">Speech Output (Text-to-Speech)</h3>
        <SettingsList>
          <SettingsRow
            title="TTS Engine"
            description="Choose between local Kokoro neural synthesis (studio human voice) or Windows built-in voice"
          >
            <Select
              data-action="settings-voice-engine"
              options={engineOptions}
              current={selectedEngine()}
              value={(opt) => opt.value}
              label={(opt) => opt.label}
              placement="bottom-end"
              gutter={6}
              onSelect={(opt) => opt && settings.voice.setEngine(opt.value)}
            />
          </SettingsRow>

          <Show when={settings.voice.engine() === "kokoro"}>
            <SettingsRow
              title="Kokoro Neural Voice"
              description="High-fidelity 82M open-weight neural voice running in background Web Worker (zero UI lag)"
            >
              <div class="flex items-center gap-2">
                <Select
                  data-action="settings-voice-kokoro-select"
                  options={kokoro.voices}
                  current={selectedKokoroVoice()}
                  value={(opt) => opt.id}
                  label={(opt) => `${opt.name} (${opt.gender}, ${opt.accent})`}
                  placement="bottom-end"
                  gutter={6}
                  onSelect={(opt) => opt && settings.voice.setKokoroVoice(opt.id)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="small"
                  class="gap-1.5 shrink-0"
                  onClick={handleTestVoice}
                >
                  <Icon name={tts.isSpeaking() ? "stop" : "volume"} size="small" />
                  <span>{tts.isSpeaking() ? "Stop" : "Preview"}</span>
                </Button>
              </div>
            </SettingsRow>

            {/* Model download / cache progress */}
            <Show when={kokoro.downloadProgress() > 0 && kokoro.downloadProgress() < 100}>
              <SettingsRow title="Downloading Kokoro Model" description="Downloading model once for offline use">
                <div class="w-48 flex flex-col gap-1">
                  <div class="w-full bg-[#261f17] h-2 rounded-full overflow-hidden">
                    <div
                      class="bg-[#e5a93c] h-full transition-all duration-300"
                      style={{ width: `${kokoro.downloadProgress()}%` }}
                    />
                  </div>
                  <span class="text-[11px] text-[#e5a93c] font-mono">{kokoro.downloadProgress()}%</span>
                </div>
              </SettingsRow>
            </Show>
          </Show>

          <Show when={settings.voice.engine() === "system"}>
            <SettingsRow
              title={language.t("settings.voice.voiceSelect.title")}
              description={language.t("settings.voice.voiceSelect.description")}
            >
              <div class="flex items-center gap-2">
                <Select
                  data-action="settings-voice-select"
                  options={systemVoiceOptions()}
                  current={selectedSystemVoice()}
                  value={(opt) => opt.id}
                  label={(opt) => opt.name}
                  placement="bottom-end"
                  gutter={6}
                  onSelect={(opt) => opt && settings.voice.setVoice(opt.id)}
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
          </Show>

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
        </SettingsList>
      </section>

      {/* 2. Speech Input (STT Engine & Settings) */}
      <section class="settings-section" aria-label="Speech Input (Speech-to-Text)">
        <h3 class="settings-section-title">Speech Input (Speech-to-Text)</h3>
        <SettingsList>
          <SettingsRow
            title="Speech-to-Text Engine"
            description="Choose between native Windows Voice Typing (instant 0ms streaming) or local Whisper"
          >
            <Select
              data-action="settings-stt-engine"
              options={sttEngineOptions}
              current={selectedSttEngine()}
              value={(opt) => opt.value}
              label={(opt) => opt.label}
              placement="bottom-end"
              gutter={6}
              onSelect={(opt) => opt && settings.voice.setSttEngine(opt.value)}
            />
          </SettingsRow>

          <Show when={settings.voice.sttEngine() === "whisper"}>
            <SettingsRow
              title="Local Whisper Model"
              description="Runs 100% locally on CPU without external servers or API keys"
            >
              <Select
                data-action="settings-whisper-model"
                options={WHISPER_MODELS}
                current={selectedWhisperModel()}
                value={(opt) => opt.id}
                label={(opt) => `${opt.name} (${opt.size})`}
                placement="bottom-end"
                gutter={6}
                onSelect={(opt) => opt && settings.voice.setWhisperModel(opt.id)}
              />
            </SettingsRow>

            <Show when={whisper.downloadProgress() > 0 && whisper.downloadProgress() < 100}>
              <SettingsRow title="Downloading Whisper Model" description="Downloading once for local offline speech recognition">
                <div class="w-48 flex flex-col gap-1">
                  <div class="w-full bg-[#261f17] h-2 rounded-full overflow-hidden">
                    <div
                      class="bg-[#e5a93c] h-full transition-all duration-300"
                      style={{ width: `${whisper.downloadProgress()}%` }}
                    />
                  </div>
                  <span class="text-[11px] text-[#e5a93c] font-mono">{whisper.downloadProgress()}%</span>
                </div>
              </SettingsRow>
            </Show>
          </Show>

          <SettingsRow
            title="Silence Pause Duration"
            description="How long to wait after you stop speaking before auto-submitting your prompt"
          >
            <div class="flex items-center gap-3">
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={settings.voice.silenceThreshold()}
                onInput={(e) => settings.voice.setSilenceThreshold(parseFloat(e.currentTarget.value))}
                class="w-32 accent-[#e5a93c]"
              />
              <span class="text-xs font-mono w-12 text-[#ede6dd]">{settings.voice.silenceThreshold()}s</span>
            </div>
          </SettingsRow>

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

      {/* 3. Activation & Hotkeys */}
      <section class="settings-section" aria-label="Activation & Hotkeys">
        <h3 class="settings-section-title">Activation & Hotkeys</h3>
        <SettingsList>
          <SettingsRow
            title="Push-to-Talk Global Hotkey"
            description="Global hotkey to start or toggle voice dictation anywhere in Windows"
          >
            <div class="flex items-center gap-2">
              <input
                type="text"
                value={settings.voice.pushToTalkHotkey()}
                onInput={(e) => settings.voice.setPushToTalkHotkey(e.currentTarget.value)}
                class="h-7 w-48 rounded-md px-2 text-xs font-mono bg-[#18130e] text-[#ede6dd] border border-[#2c2217] focus:outline-none focus:border-[#e5a93c]"
              />
            </div>
          </SettingsRow>
        </SettingsList>
      </section>
    </div>
  )
}
