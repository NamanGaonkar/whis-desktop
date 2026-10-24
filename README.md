<div align="center">
  <img src="./logo.jpg" alt="Whis Desktop Logo" width="140" style="border-radius: 22px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);" />
  <h1>Whis Desktop</h1>
  <p><strong>Production Desktop Terminal and Workspace for the Whis CLI Agent</strong></p>
  <p>
    <a href="https://github.com/NamanGaonkar/whis-desktop/releases/latest"><img src="https://img.shields.io/github/v/release/NamanGaonkar/whis-desktop?color=%23E8BF53&label=Version" alt="Release" /></a>
    <a href="https://github.com/NamanGaonkar/whis-desktop/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License" /></a>
    <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg" alt="Platforms" />
    <img src="https://img.shields.io/badge/Theme-Light%20%26%20Dark-amber.svg" alt="Dual Themes" />
  </p>
</div>

---

## ⚡ Overview

**Whis Desktop** is a sovereign, sub-second startup desktop application engineered specifically for the **Whis** CLI coding agent. It brings a bespoke developer workspace to life with genuine pseudoterminal (ConPTY) execution, seamless dual-theme styling (Light & Dark), atomic session switching, and encrypted model provider management.

---

## ✨ Features

- **Whis Logo & Visual Identity**: Integrated application icon with custom taskbar and shortcut branding derived directly from the official Whis logo.
- **Genuine Terminal Fidelity**: Full xterm-256color and truecolor emulation powered by `node-pty` / ConPTY with sub-second input-to-render streaming and automatic layout resizing.
- **Dual Studio Themes**:
  - **Light Mode**: Warm golden honey palette (`#E8BF53`, `#FAF3E0`, `#B87503`).
  - **Dark Mode**: Deep obsidian background with amber glow accents (`#0F0D0B`, `#181410`, `#F5AF28`).
- **Comprehensive Model & Provider Management**:
  - **Anthropic Claude**: Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku.
  - **OpenAI**: GPT-4o, o3-mini, GPT-4.5 Preview.
  - **Google Gemini**: Gemini 2.0 Flash, Gemini 1.5 Pro, Thinking Exp.
  - **DeepSeek**: DeepSeek-Chat (V3), DeepSeek-Reasoner (R1).
  - **Groq Cloud**: Llama 3.3 70B Versatile, DeepSeek R1 Distill Llama 70B.
  - **Local Ollama / LM Studio**: Local LLMs (`http://localhost:11434`, llama3.3, qwen2.5-coder).
  - **OpenRouter & Custom Endpoints**: Any OpenAI-compatible gateway.
- **OS-Level Keyring Encryption**: All API keys and provider tokens are encrypted at rest via Electron's native `safeStorage` (Windows DPAPI / macOS Keychain).
- **Zombieless Process Supervision**: Child processes and CLI sub-tasks are terminated with tree recursion (`taskkill /F /T` on Windows) on tab close, session switch, or window exit.
- **Quick Action Bar**: One-click pills for frequent Whis commands (`whis --mini`, `/compact`, `whis models`, `git status`, `explain codebase`).
- **Update Notifications**: Automatic background GitHub Release checker with one-click direct update notification pill.

---

## 📥 Downloads & Installation

Pre-built binaries for **v1.0.0** are available on the [**Releases Page**](https://github.com/NamanGaonkar/whis-desktop/releases/latest):

| Package Type | File | Description |
| :--- | :--- | :--- |
| **Windows Setup** | `Whis-1.0.0-win-x64-setup.exe` | Standard Windows NSIS installer with desktop shortcut |
| **Windows Portable** | `Whis-1.0.0-win-x64-portable.exe` | Zero-install standalone executable |
| **Windows Archive** | `Whis-v1.0.0-win-x64.zip` | Portable zipped unpacked bundle |

---

## 🚀 Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v20+
- Whis CLI installed in PATH (`whis`)

### Setup & Run
```bash
# Clone the repository
git clone https://github.com/NamanGaonkar/whis-desktop.git
cd whis-desktop

# Install dependencies
npm install

# Start Electron in development mode with hot module replacement
npm run dev
```

### Packaging
```bash
# Build production bundle
npm run build

# Package Windows NSIS installer and portable executable
npm run package:win

# Deploy locally to %LOCALAPPDATA%\Programs\Whis with desktop shortcut
npm run deploy:local
```

---

## 🏗️ Architecture

```
whis-desktop/
├── logo.jpg                   # Official Whis brand logo
├── src/
│   ├── main/                  # Electron Main Process (Node 20+)
│   │   ├── index.ts           # Window lifecycle, frameless window, IPC registry
│   │   ├── pty.ts             # PTY supervisor (node-pty / ConPTY)
│   │   ├── procKill.ts        # Recursive process tree supervisor
│   │   ├── shellEnv.ts        # System & user PATH detection
│   │   ├── db.ts              # Atomic persistent KV & session storage
│   │   ├── providers.ts       # Secure provider & safeStorage encryption
│   │   └── updater.ts         # GitHub Release update notifier
│   ├── preload/               # ContextBridge safe IPC API
│   │   ├── index.ts
│   │   └── index.d.ts
│   ├── renderer/              # React 18 + TypeScript + Vite
│   │   ├── src/
│   │   │   ├── design/        # Light & Dark design tokens
│   │   │   ├── components/    # TitleBar, TerminalView, ProviderModal, QuickPromptBar
│   │   │   └── stores/        # Zustand state (agentStore, providerStore, themeStore)
│   │   └── index.html
│   └── shared/                # Cross-process TypeScript contracts
└── tools/                     # Packaging, PE icon patcher & local deployment scripts
```

---

## 📄 License

MIT © [Whis Team](LICENSE)
