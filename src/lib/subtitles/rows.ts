/** Subtitles as rows: a cue, and above it the row the cue before ended on. The YouTube overlay and the settings preview draw them alike. */
import { segmentsOf } from "$lib/tokenize"

/** A cue's text, and the text of the cue before it when that one ended just before. */
export type Shown = { text: string; previous?: string | undefined }

export type RowSettings = {
  /** Whether the row the cue before ended on shows above the cue. */
  previous: boolean
  /** Whether that row slides up when the next cue starts. */
  slide: boolean
}

/** How long the cue that ended takes to slide up, and the next one to fade in. */
const SLIDE_MS = 150

/**
 * A line with each word in its own span, so hovering and clicking a word need no hit testing.
 * What is between words gets a span too, so a mark over a phrase has no gaps.
 */
const lineOf = (text: string, lang: string): HTMLElement => {
  const line = document.createElement("span")
  line.dataset.line = ""
  for (const segment of segmentsOf(text, lang)) {
    const part = document.createElement("span")
    if (segment.word) {
      part.dataset.word = ""
    }
    part.textContent = segment.text
    line.append(part)
  }
  return line
}

/**
 * A cue's lines in one span. A line break in the text, which `pre-line` shows, parts them. A `<br>` or a block per
 * line would end the text a word's sentence is read from, and the server should get the whole cue.
 */
const cueOf = (text: string, lang: string): HTMLElement => {
  const cue = document.createElement("span")
  cue.dataset.cue = ""
  cue.append(
    ...text
      .split("\n")
      .flatMap((line, index): Array<string | Node> => [...(index === 0 ? [] : ["\n"]), lineOf(line, lang)]),
  )
  return cue
}

/**
 * Hides the words of a cue above the row it ends on, as it shows now. The row left keeps its words and breaks, so
 * becoming the cue before only moves it up.
 */
const keepLastRow = (cue: HTMLElement) => {
  const parts = [...cue.querySelectorAll<HTMLElement>("[data-line] > span")]
  const boxes = parts.map((part) => part.getBoundingClientRect())
  const lastTop = Math.max(...boxes.map(({ top }) => top))
  // Half a row of slack, since a fallback font can sit a little higher on the same row.
  for (const [index, part] of parts.entries()) {
    part.hidden = boxes[index]!.top < lastTop - boxes[index]!.height / 2
  }
  // A line with nothing left would still draw its padding and background.
  for (const line of cue.querySelectorAll<HTMLElement>("[data-line]")) {
    line.hidden = [...line.children].every((part) => (part as HTMLElement).hidden)
  }
}

/**
 * Draws cues in `root`, which has the `data-dadict-captions` attribute the styles are scoped to. The returned function
 * shows a cue and says whether anything changed. `place` runs once the rows change, before a slide is measured.
 * `visible` is whether `root` showed before this cue, since only then is there a row to slide from.
 * When the cue before is the one showing, that row slides up and keeps its words, so a lookup on one stays open.
 */
export const createRows = (root: HTMLElement, settings: RowSettings, place: () => void) => {
  let shown = ""
  let current: { text: string; lang: string; element: HTMLElement } | undefined

  /** Slides everything up from where the cue now above was, and fades the new cue in. */
  const slide = (from: number, previous: HTMLElement, cue: HTMLElement) => {
    const distance = from - previous.getBoundingClientRect().bottom
    if (!settings.slide || distance <= 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }
    // `translate` adds to any `transform` that centres the subtitles.
    root.animate([{ translate: `0 ${distance}px` }, { translate: "0 0" }], {
      duration: SLIDE_MS,
      easing: "ease-out",
    })
    cue.animate([{ opacity: 0 }, { opacity: 1 }], { duration: SLIDE_MS, easing: "ease-in" })
  }

  return (cue: Shown, lang: string, visible: boolean): boolean => {
    const previous = settings.previous ? cue.previous : undefined
    const key = JSON.stringify([lang, previous, cue.text])
    if (key === shown) {
      return false
    }
    shown = key
    root.lang = lang
    const element = cueOf(cue.text, lang)
    const ended = current
    current = { text: cue.text, lang, element }
    if (previous !== undefined && ended !== undefined && ended.lang === lang && ended.text === previous) {
      // The cue that ended stays in the page rather than being drawn again, which would collapse a range on its words.
      const from = visible ? ended.element.getBoundingClientRect().bottom : undefined
      keepLastRow(ended.element)
      ended.element.dataset.previous = ""
      while (root.firstChild !== ended.element) {
        root.firstChild!.remove()
      }
      root.append("\n", element)
      place()
      if (from !== undefined) {
        slide(from, ended.element, element)
      }
      return true
    }
    if (previous === undefined) {
      root.replaceChildren(element)
    } else {
      // Laid out alone first, as it showed before a seek, to find the row it ended on.
      const before = cueOf(previous, lang)
      root.replaceChildren(before)
      keepLastRow(before)
      before.dataset.previous = ""
      root.append("\n", element)
    }
    place()
    return true
  }
}
