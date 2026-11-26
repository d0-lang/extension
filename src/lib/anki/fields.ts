/** Text as it goes into a card's fields. */
import { splitStress, stressedLetter } from "../popover/stress"

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }

export const escapeHtml = (text: string): string => text.replace(/[&<>"]/g, (char) => ESCAPES[char]!)

/** `text` as HTML, with each stressed letter in a span the note type draws the accent over, as the popover does. */
export const stressedHtml = (text: string): string =>
  splitStress(text)
    .map((part) => {
      if (!part.stressed) {
        return escapeHtml(part.text)
      }
      const letter = stressedLetter(part.text)
      return `<span class="stress" data-lift="${letter.lift}">${escapeHtml(letter.text)}</span>`
    })
    .join("")
