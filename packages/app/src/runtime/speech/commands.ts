/**
 * Whis Voice Commands & Wake Word Processing
 */

export type VoiceAction =
  | { type: "command"; command: "new-session" | "clear" | "submit" | "stop" | "show-graph" | "show-chat" }
  | { type: "wake-word-only" }
  | { type: "dictation"; text: string; hadWakeWord: boolean }

// Common variations of "Whis" and wake word greetings
const WAKE_WORD_PATTERN = /^(?:hey\s+|ok\s+|hi\s+|yo\s+)?(?:whis|whiss|wiz|with|wiss)\b[\s,:-]*/i

export function parseVoiceInput(rawText: string): VoiceAction {
  if (!rawText || !rawText.trim()) {
    return { type: "dictation", text: "", hadWakeWord: false }
  }

  const trimmed = rawText.trim()
  const hadWakeWord = WAKE_WORD_PATTERN.test(trimmed)
  const content = trimmed.replace(WAKE_WORD_PATTERN, "").trim()
  const lower = content.toLowerCase().replace(/[.!?,]$/, "").trim()

  // If the user only said "Whis" / "Hey Whis"
  if (hadWakeWord && !lower) {
    return { type: "wake-word-only" }
  }

  // Voice Command Matching
  // 1. New Session
  if (
    lower === "new session" ||
    lower === "new chat" ||
    lower === "start new session" ||
    lower === "create new session" ||
    lower === "open new session"
  ) {
    return { type: "command", command: "new-session" }
  }

  // 2. Clear input
  if (
    lower === "clear" ||
    lower === "clear input" ||
    lower === "clear prompt" ||
    lower === "clear text" ||
    lower === "reset" ||
    lower === "delete text"
  ) {
    return { type: "command", command: "clear" }
  }

  // 3. Submit / Send
  if (
    lower === "submit" ||
    lower === "send" ||
    lower === "send prompt" ||
    lower === "send message" ||
    lower === "go" ||
    lower === "ask whis" ||
    lower === "execute" ||
    lower === "run prompt"
  ) {
    return { type: "command", command: "submit" }
  }

  // 4. Stop
  if (
    lower === "stop" ||
    lower === "cancel" ||
    lower === "stop listening" ||
    lower === "be quiet" ||
    lower === "shut up" ||
    lower === "pause"
  ) {
    return { type: "command", command: "stop" }
  }

  // 5. Codebase Knowledge Graph
  if (
    lower === "show graph" ||
    lower === "open graph" ||
    lower === "view graph" ||
    lower === "codebase graph" ||
    lower === "topology" ||
    lower === "knowledge graph"
  ) {
    return { type: "command", command: "show-graph" }
  }

  // 6. Return to Chat
  if (
    lower === "show chat" ||
    lower === "open chat" ||
    lower === "view chat" ||
    lower === "back to chat" ||
    lower === "return to chat"
  ) {
    return { type: "command", command: "show-chat" }
  }

  // Default: Text dictation for prompt
  return {
    type: "dictation",
    text: hadWakeWord ? content : trimmed,
    hadWakeWord,
  }
}
