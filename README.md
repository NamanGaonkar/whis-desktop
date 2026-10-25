<div align="center">
  <img src="./logo.jpg" alt="Whis Logo" width="140" style="border-radius: 22px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);" />
  <h1>Whis Desktop 3.0.0</h1>
  <p><strong>The Standalone Open-Source AI Coder Desktop Environment</strong></p>
  <p><em>Bring Your Own Key (BYOK) · Local Ollama Models · Persistent Memory · Full Whis CLI Parity</em></p>
  <p>
    <a href="https://github.com/NamanGaonkar/whis-desktop/releases/latest"><img src="https://img.shields.io/github/v/release/NamanGaonkar/whis-desktop?color=%23E8BF53&label=Release%20v3.0.0" alt="Release" /></a>
    <a href="https://github.com/NamanGaonkar/whis-desktop/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-Apache--2.0-blue.svg" alt="License" /></a>
    <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg" alt="Platforms" />
  </p>
</div>

---

## 🚀 Overview

**Whis Desktop** is a dedicated, open-source desktop coder agent designed for software engineers. It delivers complete technical parity with the **Whis CLI** in an integrated desktop workstation:

- **Bring Your Own Key (BYOK):** Connect directly to your favorite frontier LLMs with your own API keys.
- **Local & Offline with Ollama:** 1-click auto-detection for local models running on `127.0.0.1:11434` (Llama 3.2, DeepSeek-R1, Qwen 2.5 Coder, CodeLlama).
- **Persistent Memory:** Preserves your coding style, preferences, and project rules in `~/.whis/memory/user_profile.md` and `project_context.md`, injecting them automatically into every session.
- **Direct Workspace Workflow:** Pick any directory to open directly into the interactive chat and Monaco code editor.
- **Vim Keybindings:** First-class Vim modal editing support built directly into the editor settings.
- **Accurate Token Usage:** Live token reporting and analytics across all configured providers.

---

## 🔑 Supported Providers (BYOK & Local)

Whis Desktop works on the principle of direct, ranked BYOK providers with customizable endpoints:

| Provider | Default Endpoint | Default Env Key | Popular Models |
| :--- | :--- | :--- | :--- |
| **Anthropic Claude** | `https://api.anthropic.com/v1` | `ANTHROPIC_API_KEY` | Claude 3.7 Sonnet, Claude 3.5 Sonnet, Haiku |
| **OpenAI (ChatGPT)** | `https://api.openai.com/v1` | `OPENAI_API_KEY` | GPT-4o, GPT-4o Mini, o1, o3-mini |
| **DeepSeek** | `https://api.deepseek.com/v1` | `DEEPSEEK_API_KEY` | DeepSeek-V3 (`deepseek-chat`), DeepSeek-R1 (`deepseek-reasoner`) |
| **Google Gemini** | `https://generativelanguage.googleapis.com/v1beta` | `GEMINI_API_KEY` | Gemini 2.0 Flash, Gemini 1.5 Pro, Thinking Exp |
| **xAI Grok** | `https://api.x.ai/v1` | `GROK_API_KEY` | Grok 2 (1212), Grok 2 Vision, Grok Beta |
| **Ollama (Local)** | `http://127.0.0.1:11434` | _None (Local daemon)_ | Llama 3.2, DeepSeek R1, Qwen 2.5 Coder, Mistral |
| **MiniMax** | `https://api.minimax.chat/v1` | `MINIMAX_API_KEY` | MiniMax-Text-01, abab6.5s-chat |
| **Kimi (Moonshot)** | `https://api.moonshot.cn/v1` | `MOONSHOT_API_KEY` | moonshot-v1-8k/32k/128k, kimi-k1.5-preview |
| **Z.ai (GLM / Zhipu)** | `https://open.bigmodel.cn/api/paas/v4` | `ZHIPUAI_API_KEY` | GLM-4 Plus, GLM-4 Flash, GLM-4 Air |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `OPENROUTER_API_KEY` | 200+ frontier & open-weight models via single key |

### Setting Up a Provider
1. Open **Settings** (`Ctrl+,` or from menu) → **Providers**.
2. Select any provider from the ranked catalog.
3. Enter your **API Key** (masked with show/hide toggle) and optional custom **Base URL Endpoint**.
4. For **Ollama**, click **"Detect Local Ollama (127.0.0.1:11434)"** to automatically populate your installed models.
5. Click **Save & Enable Provider**.

---

## 🧠 Persistent Memory System

Whis Desktop automatically maintains continuous memory across prompts and sessions matching Whis CLI:

- **Global User Profile (`~/.whis/memory/user_profile.md`):** Your personal instructions, coding style, token efficiency guidelines, favorite packages, and rules.
- **Project Context (`~/.whis/memory/project_context.md`):** Architecture notes, tech stack constraints, and project-specific requirements.

### Managing Memory in Settings
Open **Settings** → **Memory** to inspect, update, or reload your persistent memory files in real time. Any changes saved are immediately injected into your coding conversations.

---

## 💻 Editor & Vim Keybindings

- **Monaco Code Editor:** Full syntax highlighting, diff viewing, and multi-file editing.
- **Vim Mode:** Enable Vim modal keybindings via **Settings** → **Editor** → **Vim keybindings**.

---

## 🛠️ Installation & Getting Started

### Windows
1. Download the latest `Whis Setup 3.0.0.exe` from the [Releases](https://github.com/NamanGaonkar/whis-desktop/releases/latest) page.
2. Run the installer. Whis Desktop will launch and supervise the background daemon automatically.
3. Click **Add a project** to choose your repository folder and begin coding.

### Development & Building from Source
```bash
# Clone the repository
git clone https://github.com/NamanGaonkar/whis-desktop.git
cd whis-desktop

# Install dependencies
npm install

# Run type checks
npm run typecheck

# Build server and client
npm run build:server

# Build and package desktop app
npm run build:desktop
```

---

## 📄 Monorepo Architecture

- `packages/desktop`: Electron wrapper, daemon manager, native file pickers, window chrome.
- `packages/server`: Standalone Whis agent engine, WebSocket runtime, tool execution, process supervision.
- `packages/app`: High-performance desktop UI (React Native / Unistyles / Monaco).
- `packages/cli`: Whis terminal CLI.
- `packages/client`: TypeScript client SDK.
- `packages/protocol`: Shared types, provider configurations, wire schemas.

---

## 📜 License

Apache-2.0 © [Whis Team](LICENSE)
