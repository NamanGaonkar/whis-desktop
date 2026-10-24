<div align="center">
  <img src="./logo.jpg" alt="Whis Logo" width="140" style="border-radius: 22px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);" />
  <h1>Whis</h1>
  <p><strong>Orchestrate multiple coding agents from desktop, terminal, and mobile</strong></p>
  <p>
    <a href="https://github.com/NamanGaonkar/whis-desktop/releases/latest"><img src="https://img.shields.io/github/v/release/NamanGaonkar/whis-desktop?color=%23E8BF53&label=Release" alt="Release" /></a>
    <a href="https://github.com/NamanGaonkar/whis-desktop/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-Apache--2.0-blue.svg" alt="License" /></a>
    <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg" alt="Platforms" />
  </p>
</div>

---

## Overview

Whis is an open developer platform and desktop environment to orchestrate, supervise, and interact with local and cloud AI coding agents. Run multiple agents in parallel across separate git worktrees, stream live terminal output with full pseudoterminal fidelity, and manage LLM providers seamlessly.

---

## Supported Agents

Whis orchestrates leading AI coding agents and CLIs:
- Whis CLI
- Claude Code
- Codex
- GitHub Copilot CLI
- OpenCode
- Pi
- Antigravity
- Ollama & local LLMs

---

## Desktop App

The desktop application provides an integrated environment with automatic daemon supervision:
- Download the installer or portable executable from the Releases page.
- Launch the application to start the local workspace and daemon automatically.
- Open Settings to configure providers, API keys, or pair mobile and web clients.

---

## CLI

Everything you can do in the application, you can execute directly from the terminal:

```bash
# Run an agent on a task
whis run --provider claude/sonnet "implement authentication"

# Run an agent in a designated worktree
whis run --provider openai/gpt-4o --worktree feature-auth "implement feature X"

# List active sessions and agents
whis ls

# Stream live terminal output
whis attach <agent-id>

# Send an instruction or follow-up to a running session
whis send <agent-id> "run tests and fix lint errors"
```

---

## Server & Daemon

To run the daemon on a remote workstation, VM, or headless server:

```bash
# Start the daemon
npm start
```

The daemon provides WebSocket APIs, MCP protocol endpoints, and encrypted session relay.

---

## Docker

Run the Whis daemon and web interface in Docker:

```bash
docker run -d --name whis \
  -p 6767:6767 \
  -e WHIS_PASSWORD=change-me \
  -v "$PWD/whis-home:/home/whis" \
  -v "$PWD:/workspace" \
  ghcr.io/namangaonkar/whis:latest
```

---

## TypeScript SDK

Build integrations, dashboards, and automated services with `@whis/client`:

```ts
import { createWhisClient } from "@whis/client";

const client = createWhisClient({ url: "ws://127.0.0.1:6767/ws" });
await client.connect();

const agent = await client.agents.create({
  config: { provider: "whis" },
  cwd: process.cwd(),
  prompt: "Review the current diff and summarize changes."
});

const result = await agent.waitForFinish();
console.log(result.lastMessage);

await client.close();
```

---

## Development

Monorepo package overview:

- `packages/desktop`: Electron desktop application
- `packages/server`: Whis daemon (agent process orchestration, WebSocket API, MCP server)
- `packages/app`: Expo cross-platform client (desktop web, iOS, Android)
- `packages/cli`: `whis` CLI for daemon and agent workflows
- `packages/client`: TypeScript client SDK
- `packages/protocol`: Wire protocol contracts and schemas
- `packages/relay`: Relay transport and encryption
- `packages/website`: Marketing site and documentation

Common commands:

```bash
# Run local development services
npm run dev

# Run individual packages
npm run dev:server
npm run dev:app
npm run dev:desktop

# Build server and client packages
npm run build:server

# Run type checks across monorepo
npm run typecheck
```

---

## License

Apache-2.0 © [Whis Team](LICENSE)
