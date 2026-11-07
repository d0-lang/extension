const STRESS_MARK = "́"

/** A letter with the marks that follow it. */
const CLUSTER = /\P{M}\p{M}*|\p{M}+/gu

/**
 * Splits `text` at its stress marks (U+0301), with each mark removed and its letter set apart.
 * Many fonts place that mark after the letter instead of over it, so the popover draws it instead.
 */
export const splitStress = (text: string): Array<{ text: string; stressed: boolean }> => {
  const parts: Array<{ text: string; stressed: boolean }> = []
  for (const [cluster] of text.matchAll(CLUSTER)) {
    const stressed = cluster.includes(STRESS_MARK) && cluster.length > 1
    const shown = stressed ? cluster.replace(STRESS_MARK, "") : cluster
    const last = parts.at(-1)
    if (last !== undefined && !last.stressed && !stressed) {
      last.text += shown
    } else {
      parts.push({ text: shown, stressed })
    }
  }
  return parts
}

/** Letters whose dot the accent replaces, as in í. */
const DOTLESS: Record<string, string> = { i: "ı", і: "ı" }

/** Combining marks that sit below the letter, which leave room for the accent. */
const isMarkBelow = (mark: string): boolean => {
  const code = mark.codePointAt(0) ?? 0
  return code >= 0x316 && code <= 0x333
}

/**
 * How to draw the accent over a stressed `letter`.
 * `lift` is 1 over a capital or a mark above, like ї or ё, and 2 over both.
 */
export const stressedLetter = (letter: string): { text: string; lift: 0 | 1 | 2 } => {
  const dotless = DOTLESS[letter]
  if (dotless !== undefined) {
    return { text: dotless, lift: 0 }
  }
  const upper = letter !== letter.toLowerCase()
  const marked = [...letter.normalize("NFD").matchAll(/\p{M}/gu)].some(([mark]) => !isMarkBelow(mark))
  return { text: letter, lift: upper && marked ? 2 : upper || marked ? 1 : 0 }
}
