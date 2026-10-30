/**
 * Normalizes technical markdown text into natural human speech.
 * Expands GPU models (e.g. RTX 4050 -> RTX 40 50, spoken as "forty fifty"),
 * electrical units (140w -> 140 watts), memory/frequencies (16GB -> 16 gigabytes),
 * and strips code blocks and syntax tokens.
 */
export function normalizeForSpeech(text: string): string {
  if (!text) return ""

  let cleaned = text

  // 1. Replace fenced code blocks
  cleaned = cleaned.replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, (_match, codeContent) => {
    const lines = codeContent.trim().split("\n")
    if (lines.length > 5) {
      return " [Here is the code block.] "
    }
    return " [Code block provided.] "
  })

  // 2. Replace inline code
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1")

  // 3. Replace markdown links
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")

  // 4. Replace raw URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, "link")

  // 5. Remove headers, blockquotes, horizontal rules
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "")
  cleaned = cleaned.replace(/^>\s+/gm, "")
  cleaned = cleaned.replace(/^[-*_]{3,}\s*$/gm, "")

  // 6. Remove list markers
  cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, "")
  cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, "")

  // 7. Remove emphasis markers
  cleaned = cleaned.replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")

  // 8. Remove HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, "")

  // 9. Hardware & GPU models pronunciation (RTX 4050 -> RTX 40 50, spoken as "forty fifty")
  cleaned = cleaned.replace(
    /\b(RTX|GTX|RX|GeForce|Radeon|Arc|Intel|Core|Ryzen)\s*(\d{2})(\d{2})\b/gi,
    "$1 $2 $3",
  )

  // 10. Electrical and Power Units (140w -> 140 watts)
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[wW]\b/g, (_m, num) => {
    return Number(num) === 1 ? `${num} watt` : `${num} watts`
  })
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[kK][wW]\b/g, "$1 kilowatts")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[vV]\b/g, "$1 volts")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[aA]\b/g, "$1 amps")

  // 11. Memory and Storage Units
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[gG][bB]\b/g, "$1 gigabytes")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[mM][bB]\b/g, "$1 megabytes")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[tT][bB]\b/g, "$1 terabytes")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[kK][bB]\b/g, "$1 kilobytes")

  // 12. Frequencies
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[gG][hH][zZ]\b/g, "$1 gigahertz")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[mM][hH][zZ]\b/g, "$1 megahertz")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[hH][zZ]\b/g, "$1 hertz")

  // 13. Time and Performance Metrics
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*ms\b/gi, "$1 milliseconds")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*fps\b/gi, "$1 frames per second")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*px\b/gi, "$1 pixels")

  // 14. Collapse whitespace
  cleaned = cleaned.replace(/\n+/g, ". ").replace(/\s{2,}/g, " ")

  return cleaned.trim()
}
