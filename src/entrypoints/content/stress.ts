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
