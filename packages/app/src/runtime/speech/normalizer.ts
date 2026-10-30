/**
 * Normalizes markdown/assistant technical output into natural human speech.
 * Skips raw code blocks, syntax clutter, and expands technical terms and units.
 */
export function normalizeForSpeech(text: string): string {
  if (!text) return ""

  let cleaned = text

  // 1. Replace fenced code blocks with a brief natural summary
  cleaned = cleaned.replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, (_match, codeContent) => {
    const lines = codeContent.trim().split("\n")
    if (lines.length > 5) {
      return " [Here is the code block.] "
    }
    return " [Code block provided.] "
  })

  // 2. Replace inline code blocks `code`
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1")

  // 3. Replace markdown links [label](url) with just label
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")

  // 4. Replace raw URLs with "link"
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, "link")

  // 5. Remove markdown headers #, ##, ###
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "")

  // 6. Remove blockquotes >
  cleaned = cleaned.replace(/^>\s+/gm, "")

  // 7. Remove markdown horizontal rules --- or ***
  cleaned = cleaned.replace(/^[-*_]{3,}\s*$/gm, "")

  // 8. Remove bullet points - or * at start of lines
  cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, "")

  // 9. Remove numbered list prefixes 1. 2.
  cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, "")

  // 10. Remove emphasis markers (* and _)
  cleaned = cleaned.replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")

  // 11. Remove HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, "")

  // 12. GPU and Hardware Model Pronunciation
  // Pronounce 4-digit GPU models naturally in pairs (e.g. RTX 4050 -> RTX 40 50, spoken as "RTX forty fifty" instead of "four thousand fifty")
  cleaned = cleaned.replace(
    /\b(RTX|GTX|RX|GeForce|Radeon|Arc|Intel|Core|Ryzen)\s*(\d{2})(\d{2})\b/gi,
    "$1 $2 $3",
  )

  // 13. Electrical and Power Units
  // 140w or 140 W -> 140 watts, 1w -> 1 watt
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[wW]\b/g, (_m, num) => {
    return Number(num) === 1 ? `${num} watt` : `${num} watts`
  })
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[kK][wW]\b/g, "$1 kilowatts")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[vV]\b/g, "$1 volts")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[aA]\b/g, "$1 amps")

  // 14. Memory and Storage Units
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[gG][bB]\b/g, "$1 gigabytes")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[mM][bB]\b/g, "$1 megabytes")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[tT][bB]\b/g, "$1 terabytes")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[kK][bB]\b/g, "$1 kilobytes")

  // 15. Frequency and Clock Speeds
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[gG][hH][zZ]\b/g, "$1 gigahertz")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[mM][hH][zZ]\b/g, "$1 megahertz")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[kK][hH][zZ]\b/g, "$1 kilohertz")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[hH][zZ]\b/g, "$1 hertz")

  // 16. Time and Performance Metrics
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*ms\b/gi, "$1 milliseconds")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*fps\b/gi, "$1 frames per second")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*px\b/gi, "$1 pixels")

  // 17. Collapse multiple newlines and spaces
  cleaned = cleaned.replace(/\n+/g, ". ").replace(/\s{2,}/g, " ")

  return cleaned.trim()
}
