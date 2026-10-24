# Whis Desktop

> Production Desktop Terminal and Workspace for the **Whis** CLI coding agent.

Whis Desktop delivers a sovereign, sub-second startup, low-latency desktop interface engineered specifically for **Whis**. Run your AI pair programmer with full ConPTY terminal fidelity, switch seamlessly between Light and Dark mode, and effortlessly manage LLM providers.

---

## ✨ Features

- **Pure Whis Core**: 100% focused on running the Whis CLI agent with zero multi-agent bloat or gimmicks.
- **ConPTY Terminal Fidelity**: Emulates genuine xterm-256color / truecolor pseudo-terminals with WebGL acceleration and automatic viewport resizing.
- **Gorgeous Light & Dark Mode**:
  - **Light Mode**: Warm golden honey studio theme (`#E8BF53`, `#FAF3E0`, `#B87503`).
  - **Dark Mode**: Deep obsidian with glowing golden amber accents (`#0F0D0B`, `#181410`, `#F5AF28`).
- **Comprehensive Provider & Model Management**:
  - Anthropic Claude (Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku)
  - OpenAI (GPT-4o, o3-mini, GPT-4.5)
  - Google Gemini (Gemini 2.0 Flash, Gemini 1.5 Pro)
  - DeepSeek (DeepSeek V3, DeepSeek R1)
  - Groq Cloud (Llama 3.3 70B, DeepSeek R1 Distill)
  - Local Ollama / LM Studio (`http://localhost:11434`, llama3.3, qwen2.5-coder)
  - OpenRouter & Custom OpenAI-compatible endpoints
- **OS Keychain Encryption**: API keys are securely encrypted at rest using Electron's native `safeStorage` (Windows DPAPI / macOS Keychain).
- **Hardened Process Lifecycle**: Prevents zombie background processes using recursive process tree termination (`taskkill /F /T` on Windows, `kill -9` on Unix).
- **Workspace Navigation**: Instant folder switcher to target any local repository or directory for Whis.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Whis CLI installed (`whis` in PATH or `go/bin/whis.exe`)

### Development
```bash
# Install dependencies
npm install

# Start Electron in development mode with HMR
npm run dev
```

### Packaging & Distribution
```bash
# Compile and build out/
npm run build

# Package Windows NSIS installer & portable exe
npm run package:win

# Deploy locally to %LOCALAPPDATA%\Programs\Whis with shortcut creation
npm run deploy:local
```

---

## 🏗️ Architecture

```
Whis Desktop/
├── src/
│   ├── main/                  # Electron Main Process (Node 20+)
│   │   ├── index.ts           # App lifecycle, frameless window, IPC handlers
│   │   ├── pty.ts             # PTY supervisor (node-pty / ConPTY)
│   │   ├── procKill.ts        # Recursive process tree supervisor
│   │   ├── shellEnv.ts        # System & user PATH detection
│   │   ├── db.ts              # Atomic persistent KV & session storage
│   │   └── providers.ts       # Secure provider & model manager
│   ├── preload/               # ContextBridge safe IPC API
│   │   ├── index.ts
│   │   └── index.d.ts
│   ├── renderer/              # React 18 + TypeScript + Vite
│   │   ├── src/
│   │   │   ├── design/        # Light & Dark tokens (tokens.css, tokens.ts)
│   │   │   ├── components/    # TitleBar, TerminalView, ProviderModal, QuickPromptBar
│   │   │   └── stores/        # Zustand state (agentStore, providerStore, themeStore)
│   └── shared/                # Cross-process TypeScript contracts
└── tools/                     # Packaging, PE icon patcher & local deployment scripts
```
