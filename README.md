<p align="center">
  <img src="logo.jpg" alt="Whis Logo" width="160" height="160" style="border-radius: 20px;">
</p>

<h1 align="center">Whis Desktop & CLI</h1>

<p align="center">
  <strong>The Autonomous Bring-Your-Own-Key (BYOK) AI Coding Agent & Desktop Workspace</strong>
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-4.0.0--fix-amber?style=flat-square" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-orange?style=flat-square" />
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-black?style=flat-square" />
</p>

---

## Overview

**Whis** is an autonomous AI coding agent and interactive workspace designed for engineers who want powerful agentic coding with complete control over their models and API keys.

Operating with a strict **Bring-Your-Own-Key (BYOK)** architecture, Whis connects directly to model providers or local models without any proprietary cloud lock-in, middleman proxy, or subscription traps.

- **Desktop GUI & CLI Unified**: Single shared database (`~/.local/share/whis/opencode.db`) keeping all sessions, history, and workspace contexts synchronized across terminal and desktop.
- **Pure BYOK**: Connect your API keys directly to Anthropic, DeepSeek, OpenAI, Google Gemini, Groq, Kimi (Moonshot), MiniMax, Zhipu AI (GLM), Ollama (local and remote), OpenRouter, and more.
- **Autonomous Tool Execution**: Read and edit files, run commands, execute bash scripts, inspect git state, and manage workspace projects.
- **Dark Amber & Orange Mix**: Bespoke aesthetic crafted with rich dark amber (`#D97706` / `#F59E0B`) and warm orange accents over a deep `#0e0e11` obsidian canvas.
- **Local Memory & Workspace Context**: Persistent memory and workspace configurations stored locally on your machine.

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.2+)
- [Node.js](https://nodejs.org/) (v20+)

### Building from Source

Clone the repository and install dependencies:

```bash
git clone https://github.com/naman-whis/whis-desktop.git
cd "whis-desktop"
bun install
```

### Running the Desktop App in Development

```bash
bun --cwd packages/desktop dev
```

### Packaging for Windows

```bash
# Build desktop packages
bun --cwd packages/desktop build

# Package unpacked Windows binary
npx electron-builder --win --dir
```

The output application will be located at:
`packages/desktop/dist/win-unpacked/Whis.exe`

---

## Bring Your Own Key (BYOK)

Whis does not require an external account or proxy. Simply add your API keys directly in the **Providers** settings panel or export them in your shell environment:

| Provider | Environment Variable | Models Supported |
| :--- | :--- | :--- |
| **DeepSeek** | `DEEPSEEK_API_KEY` | DeepSeek-V3, DeepSeek-R1 |
| **Anthropic** | `ANTHROPIC_API_KEY` | Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku |
| **OpenAI** | `OPENAI_API_KEY` | GPT-4o, o1, o3-mini |
| **Google Gemini** | `GEMINI_API_KEY` | Gemini 2.5 Pro, Gemini 2.0 Flash |
| **Ollama** | `OLLAMA_API_BASE` | Qwen 2.5 Coder, DeepSeek-R1, Llama 3.3, local models |
| **OpenRouter** | `OPENROUTER_API_KEY` | Aggregated multi-model endpoints |
| **Moonshot (Kimi)** | `MOONSHOT_API_KEY` | Kimi K2, Kimi K2.5 |
| **MiniMax** | `MINIMAX_API_KEY` | MiniMax-M2.5, MiniMax-M2.7 |
| **Zhipu AI (GLM)** | `ZHIPU_API_KEY` | GLM-4.5, GLM-5 |

---

## Architecture & Data Storage

Whis stores all runtime data locally in your user profile:

- **Sessions & History**: `~/.local/share/whis/opencode.db`
- **Configuration**: `~/.config/whis/whis.jsonc`
- **Application State & Prompts**: `~/.local/state/whis/`

---

## License

MIT © Whis Team
