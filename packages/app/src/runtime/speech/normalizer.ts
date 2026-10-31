const TWO_DIGIT_WORDS: Record<string, string> = {
  "10": "ten", "11": "eleven", "12": "twelve", "13": "thirteen", "14": "fourteen",
  "15": "fifteen", "16": "sixteen", "17": "seventeen", "18": "eighteen", "19": "nineteen",
  "20": "twenty", "25": "twenty-five",
  "30": "thirty", "35": "thirty-five",
  "40": "forty", "45": "forty-five",
  "50": "fifty", "55": "fifty-five",
  "60": "sixty", "65": "sixty-five",
  "70": "seventy", "75": "seventy-five",
  "80": "eighty", "85": "eighty-five",
  "90": "ninety", "95": "ninety-five",
  "00": "hundred",
}

function twoDigitsToWords(n: string): string {
  if (TWO_DIGIT_WORDS[n]) return TWO_DIGIT_WORDS[n]
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
  const units = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
  const d1 = parseInt(n[0], 10)
  const d2 = parseInt(n[1], 10)
  if (d1 === 0) return units[d2] || ""
  if (d1 === 1) return TWO_DIGIT_WORDS[n] || n
  return `${tens[d1]} ${units[d2]}`.trim()
}

/**
 * Normalizes markdown/assistant technical output into natural human speech.
 * Skips raw code blocks, syntax clutter, emojis, dashes, and expands technical terms and units.
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

  // 8. Emojis, Emoticons and Pictographs Removal
  // Strip markdown shortcodes like :smile:, :thumbsup:, :heart:
  cleaned = cleaned.replace(/:[a-zA-Z0-9_+-]+:/g, "")
  // Strip common text emoticons: :) :( :-) :D :-D ;) <3 xD etc.
  cleaned = cleaned.replace(/(^|\s)([:;8][-o']?[)DdpP(\\/\]|]|[<>]?3|xD|XD)(\s|$)/g, "$1$3")
  // Strip Unicode emojis, pictographs, symbols, dingbats, regional flags, variation selectors
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}]/gu, "")
  try {
    cleaned = cleaned.replace(/\p{Extended_Pictographic}/gu, "")
    cleaned = cleaned.replace(/\p{Emoji_Presentation}/gu, "")
  } catch {}

  // 9. Lists, Points and Bullets
  // Numbered list prefixes (e.g. "1. First step", "2) Second step") -> "Point 1: First step."
  cleaned = cleaned.replace(/^[\s]*(\d+)[\.\)]\s+/gm, "Point $1: ")
  // Bullet points (-, *, +, •, ◦, ▪, ▫, ◆, ✓, ✔, ➢, ➤) at start of lines -> "Point: "
  cleaned = cleaned.replace(/^[\s]*[-*+•◦▪▫◆✓✔➢➤]\s+/gm, "Point: ")

  // 10. Dashes and Hyphens
  // Convert em-dashes (—), en-dashes (–), double/triple hyphens (--) to natural pauses
  cleaned = cleaned.replace(/[—–]/g, ", ")
  cleaned = cleaned.replace(/--+/g, ", ")
  // Convert isolated hyphens surrounded by spaces (" - ") or at edge of words to a comma pause
  cleaned = cleaned.replace(/\s+-\s+/g, ", ")
  cleaned = cleaned.replace(/(^|\s)-+(?=\s|$)/gm, "$1, ")

  // 11. Remove emphasis markers (* and _)
  cleaned = cleaned.replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")

  // 12. Remove HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, "")

  // 13. App Name Pronunciation
  // Pronounce "Whis" cleanly and naturally
  cleaned = cleaned.replace(/\b[wW]hiss\b/g, "Whis")

  // 14. GPU and Hardware Model Pronunciation
  // Pronounce 4-digit GPU models naturally in words (e.g. RTX 4050 -> RTX forty fifty instead of "four thousand fifty")
  cleaned = cleaned.replace(
    /\b(RTX|GTX|RX|GeForce|Radeon|Arc|Intel|Core|Ryzen|NVIDIA)?\s*([1-9]\d)(00|10|20|30|40|50|60|70|80|90|50|60|70|80|90|\d{2})\b/gi,
    (_match, prefix, high, low) => {
      const p = prefix ? `${prefix} ` : ""
      return `${p}${twoDigitsToWords(high)} ${twoDigitsToWords(low)}`
    },
  )

  // 15. Electrical and Power Units
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[wW]\b/g, (_m, num) => {
    return Number(num) === 1 ? `${num} watt` : `${num} watts`
  })
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[kK][wW]\b/g, "$1 kilowatts")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[vV]\b/g, "$1 volts")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[aA]\b/g, "$1 amps")

  // 16. Memory and Storage Units
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[gG][bB]\b/g, "$1 gigabytes")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[mM][bB]\b/g, "$1 megabytes")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[tT][bB]\b/g, "$1 terabytes")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[kK][bB]\b/g, "$1 kilobytes")

  // 17. Frequency and Clock Speeds
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[gG][hH][zZ]\b/g, "$1 gigahertz")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[mM][hH][zZ]\b/g, "$1 megahertz")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[kK][hH][zZ]\b/g, "$1 kilohertz")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*[hH][zZ]\b/g, "$1 hertz")

  // 18. Time and Performance Metrics
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*ms\b/gi, "$1 milliseconds")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*fps\b/gi, "$1 frames per second")
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*px\b/gi, "$1 pixels")

  // 19. Punctuation cleanup (eliminate awkward delays between multiple punctuations like !!, ..., :., ,.)
  // If colon precedes a newline, convert to period
  cleaned = cleaned.replace(/:\s*(?=\n)/g, ".")
  // Clean combinations like :. or ;.
  cleaned = cleaned.replace(/[:;]\s*([.!?])/g, "$1")
  // Deduplicate multiple punctuation marks
  cleaned = cleaned.replace(/!+/g, "!")
  cleaned = cleaned.replace(/\?+/g, "?")
  cleaned = cleaned.replace(/\.{2,}/g, ".")
  cleaned = cleaned.replace(/,{2,}/g, ",")
  cleaned = cleaned.replace(/,\s*\./g, ".")
  cleaned = cleaned.replace(/\.\s*,/g, ".")

  // 20. Collapse multiple newlines into clean sentence transitions
  cleaned = cleaned.replace(/\n+/g, ". ").replace(/\s{2,}/g, " ")
  // Remove space before punctuation (e.g. "word , next" -> "word, next")
  cleaned = cleaned.replace(/\s+([,.:!?])/g, "$1")
  // Final clean up of doubled periods after newline replacement
  cleaned = cleaned.replace(/\.\s*\./g, ".")

  return cleaned.trim()
}
