/**
 * Normalizes markdown/assistant technical output into natural human speech.
 * Skips raw code blocks, syntax clutter, and repetitive markdown tokens.
 */
export function normalizeForSpeech(text: string): string {
  if (!text) return ""

  let cleaned = text

  // Replace fenced code blocks with a brief natural summary
  cleaned = cleaned.replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, (_match, codeContent) => {
    const lines = codeContent.trim().split("\n")
    if (lines.length > 5) {
      return " [Here is the code block.] "
    }
    return " [Code block provided.] "
  })

  // Replace inline code blocks `code`
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1")

  // Replace markdown links [label](url) with just label
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")

  // Replace raw URLs with "link"
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, "link")

  // Remove markdown headers #, ##, ###
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "")

  // Remove blockquotes >
  cleaned = cleaned.replace(/^>\s+/gm, "")

  // Remove markdown horizontal rules --- or ***
  cleaned = cleaned.replace(/^[-*_]{3,}\s*$/gm, "")

  // Remove bullet points - or * at start of lines
  cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, "")

  // Remove numbered list prefixes 1. 2.
  cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, "")

  // Remove emphasis markers (* and _)
  cleaned = cleaned.replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")

  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, "")

  // Collapse multiple newlines and spaces
  cleaned = cleaned.replace(/\n+/g, ". ").replace(/\s{2,}/g, " ")

  return cleaned.trim()
}
