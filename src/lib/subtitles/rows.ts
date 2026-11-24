/** Subtitles as rows: a cue, and above it the row the cue before ended on. The YouTube overlay and the settings preview draw them alike. */
import { segmentsOf } from "$lib/tokenize"

/** How a creator styled part of a cue. */
export type TextStyle = { color?: string; italic?: boolean; bold?: boolean }

/** A style over a cue's text, from the character at `from` up to the one at `to`. */
export type StyleRun = TextStyle & { from: number; to: number }

/** A cue's text, lines apart with `\n`, and how a creator styled parts of it. */
export type Styled = { text: string; styles?: ReadonlyArray<StyleRun> | undefined }

/**
 * Where a creator put a cue: the point of it that `anchor` names, from 0 at the top left to 8 at the bottom right,
 * `x` and `y` percent across and down the player.
 */
export type Place = { anchor: number; x: number; y: number }

/** A cue, the cue before it when that one ended just before in the same place, and where the creator put it. */
export type Shown = Styled & { previous?: Styled | undefined; place?: Place | undefined }

export type RowSettings = {
  /** Whether the row the cue before ended on shows above the cue. */
  previous: boolean
  /** Whether the next cue fades in when it starts. */
  fade: boolean
}

/** How long the next cue takes to fade in. */
const FADE_MS = 100

/**
 * A line with each word in its own span, so hovering and clicking a word need no hit testing.
 * What is between words gets a span too, so a mark over a phrase has no gaps.
 */
const lineOf = (
  text: string,
  lang: string,
  styleAt: (offset: number) => TextStyle | undefined,
): HTMLElement => {
  const line = document.createElement("span")
  line.dataset.line = ""
  let offset = 0
  for (const segment of segmentsOf(text, lang)) {
    const part = document.createElement("span")
    if (segment.word) {
      part.dataset.word = ""
    }
    part.textContent = segment.text
    paint(part, styleAt(offset))
    offset += segment.text.length
    line.append(part)
  }
  return line
}

/** Draws a part of a line the way its creator styled it. A style that starts inside the part takes it from there. */
const paint = (part: HTMLElement, style: TextStyle | undefined) => {
  if (style?.color !== undefined) {
    part.style.color = style.color
  }
  if (style?.italic === true) {
    part.style.fontStyle = "italic"
  }
  if (style?.bold === true) {
    part.style.fontWeight = "bold"
  }
}

/**
 * A cue's lines in one span. A line break in the text, which `pre-line` shows, parts them. A `<br>` or a block per
 * line would end the text a word's sentence is read from, and the server should get the whole cue.
 */
const cueOf = ({ text, styles = [] }: Styled, lang: string): HTMLElement => {
  const cue = document.createElement("span")
  cue.dataset.cue = ""
  let start = 0
  for (const [index, line] of text.split("\n").entries()) {
    const from = start
    const styleAt = (offset: number) =>
      styles.find((run) => run.from <= from + offset && from + offset < run.to)
    cue.append(...(index === 0 ? [] : ["\n"]), lineOf(line, lang, styleAt))
    start += line.length + 1
  }
  return cue
}

/** Tells cues apart by their text and styles. */
const keyOf = ({ text, styles = [] }: Styled): string => JSON.stringify([text, styles])

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
 * shows a cue and says whether anything changed. `place` runs once the rows change.
 * `visible` is whether `root` showed before this cue, since only then does the next one fade in after it.
 * When the cue before is the one showing, that row moves up and keeps its words, so a lookup on one stays open.
 */
export const createRows = (root: HTMLElement, settings: RowSettings, place: () => void) => {
  let shown = ""
  let current: { key: string; lang: string; element: HTMLElement } | undefined

  /** Fades the next cue in. Nothing moves, so fast dialogue does not keep the subtitles in motion. */
  const fadeIn = (cue: HTMLElement) => {
    if (settings.fade && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cue.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: "ease-in" })
    }
  }

  return (cue: Shown, lang: string, visible: boolean): boolean => {
    const previous = settings.previous ? cue.previous : undefined
    const key = JSON.stringify([lang, previous === undefined ? undefined : keyOf(previous), keyOf(cue)])
    if (key === shown) {
      return false
    }
    shown = key
    root.lang = lang
    const element = cueOf(cue, lang)
    const ended = current
    current = { key: keyOf(cue), lang, element }
    if (
      previous !== undefined &&
      ended !== undefined &&
      ended.lang === lang &&
      ended.key === keyOf(previous)
    ) {
      // The cue that ended stays in the page rather than being drawn again, which would collapse a range on its words.
      keepLastRow(ended.element)
      ended.element.dataset.previous = ""
      while (root.firstChild !== ended.element) {
        root.firstChild!.remove()
      }
      root.append("\n", element)
      place()
      if (visible) {
        fadeIn(element)
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
