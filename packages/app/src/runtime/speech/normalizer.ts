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

  // 12. App Name Pronunciation
  // Pronounce "Whis" as "Whiss" (/wɪs/) instead of "whys" (/waɪz/)
  cleaned = cleaned.replace(/\b[wW]his\b/g, "Whiss")
  cleaned = cleaned.replace(/\b[wW]his[- ]([a-zA-Z]+)\b/g, "Whiss $1")

  // 13. GPU and Hardware Model Pronunciation
  // Pronounce 4-digit GPU models naturally in words (e.g. RTX 4050 -> RTX forty fifty instead of "four thousand fifty")
  cleaned = cleaned.replace(
    /\b(RTX|GTX|RX|GeForce|Radeon|Arc|Intel|Core|Ryzen|NVIDIA)?\s*([1-9]\d)(00|10|20|30|40|50|60|70|80|90|50|60|70|80|90|\d{2})\b/gi,
    (_match, prefix, high, low) => {
      const p = prefix ? `${prefix} ` : ""
      return `${p}${twoDigitsToWords(high)} ${twoDigitsToWords(low)}`
    },
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
