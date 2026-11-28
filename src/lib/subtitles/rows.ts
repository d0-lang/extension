/** Subtitles as rows: a cue, and above it the row the cue before ended on. The YouTube overlay and the settings preview draw them alike. */
import { segmentsOf } from "$lib/tokenize"
import { readableColour } from "./colour"

/** How a creator styled part of a cue. */
export type TextStyle = { color?: string; italic?: boolean; bold?: boolean }

/** A style over a cue's text, from the character at `from` up to the one at `to`. */
export type StyleRun = TextStyle & { from: number; to: number }

/** A reading over a cue's text, like furigana over kanji, from the character at `from` up to the one at `to`. */
export type Ruby = { from: number; to: number; text: string }

/**
 * A cue's text, lines apart with `\n`, how a creator styled parts of it, and the readings over parts of it, in order.
 * A reading is never part of `text`, so it is not looked up or copied.
 */
export type Styled = {
  text: string
  styles?: ReadonlyArray<StyleRun> | undefined
  ruby?: ReadonlyArray<Ruby> | undefined
}

/**
 * Where a creator put a cue: the point of it that `anchor` names, from 0 at the top left to 8 at the bottom right,
 * `x` and `y` percent across and down the player.
 */
export type Place = { anchor: number; x: number; y: number }

/**
 * A cue, the cue before it when that one ended just before in the same place, and where the creator put it. `held` is
 * whether the cue has ended and stays, dimmed, in the silence after it.
 */
export type Shown = Styled & { previous?: Styled | undefined; place?: Place | undefined; held?: boolean }

export type RowSettings = {
  /** Whether the row the cue before ended on shows above the cue. */
  previous: boolean
  /** Whether that row slides up when the next cue starts. */
  slide: boolean
}

/** How long the cue that ended takes to slide up, and the next one to fade in. */
const SLIDE_MS = 150

/** A line's words and what is between them. A reading over parts of two words makes them one, read together. */
const partsOf = (
  text: string,
  lang: string,
  ruby: ReadonlyArray<Ruby>,
): Array<{ text: string; word: boolean; from: number }> => {
  const parts: Array<{ text: string; word: boolean; from: number }> = []
  let offset = 0
  for (const segment of segmentsOf(text, lang)) {
    const last = parts.at(-1)
    if (last !== undefined && ruby.some(({ from, to }) => from < offset && offset < to)) {
      last.text += segment.text
      last.word ||= segment.word
    } else {
      parts.push({ text: segment.text, word: segment.word, from: offset })
    }
    offset += segment.text.length
  }
  return parts
}

/**
 * Fills `part`, which starts at `from` in its line, with its text. The characters a reading is over get a span of their
 * own that draws it above them, from an attribute, so it is never the page's text.
 */
const fill = (part: HTMLElement, text: string, from: number, ruby: ReadonlyArray<Ruby>) => {
  let at = 0
  for (const reading of ruby) {
    if (reading.from >= from && reading.to <= from + text.length) {
      const base = document.createElement("span")
      base.dataset.ruby = reading.text
      base.textContent = text.slice(reading.from - from, reading.to - from)
      part.append(text.slice(at, reading.from - from), base)
      at = reading.to - from
    }
  }
  part.append(text.slice(at))
}

/**
 * A line with each word in its own span, so hovering and clicking a word need no hit testing.
 * What is between words gets a span too, so a mark over a phrase has no gaps. `ruby` counts from the line's start.
 */
const lineOf = (
  text: string,
  lang: string,
  styleAt: (offset: number) => TextStyle | undefined,
  ruby: ReadonlyArray<Ruby>,
): HTMLElement => {
  const line = document.createElement("span")
  line.dataset.line = ""
  // A right-to-left line keeps its punctuation at its own end.
  line.dir = "auto"
  for (const segment of partsOf(text, lang, ruby)) {
    const part = document.createElement("span")
    if (segment.word) {
      part.dataset.word = ""
    }
    fill(part, segment.text, segment.from, ruby)
    paint(part, styleAt(segment.from))
    line.append(part)
  }
  return line
}

/**
 * Draws a part of a line the way its creator styled it, in a colour light enough to read. A style that starts inside
 * the part takes it from there.
 */
const paint = (part: HTMLElement, style: TextStyle | undefined) => {
  const color = style?.color === undefined ? undefined : readableColour(style.color)
  if (color !== undefined) {
    part.style.color = color
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
const cueOf = ({ text, styles = [], ruby = [] }: Styled, lang: string): HTMLElement => {
  const cue = document.createElement("span")
  cue.dataset.cue = ""
  let start = 0
  for (const [index, line] of text.split("\n").entries()) {
    const from = start
    const styleAt = (offset: number) =>
      styles.find((run) => run.from <= from + offset && from + offset < run.to)
    const lineRuby = ruby
      .filter((reading) => reading.from >= from && reading.to <= from + line.length)
      .map((reading) => ({ ...reading, from: reading.from - from, to: reading.to - from }))
    cue.append(...(index === 0 ? [] : ["\n"]), lineOf(line, lang, styleAt, lineRuby))
    start += line.length + 1
  }
  return cue
}

/** Tells cues apart by their text, styles and readings. */
const keyOf = ({ text, styles = [], ruby = [] }: Styled): string => JSON.stringify([text, styles, ruby])

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
  let current: { key: string; lang: string; element: HTMLElement } | undefined

  /** Slides everything up from where the cue now above was, and fades the new cue in. */
  const slide = (from: number, previous: HTMLElement, cue: HTMLElement) => {
    const distance = from - previous.getBoundingClientRect().bottom
    if (!settings.slide || distance <= 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }
    // Added to whatever centres the subtitles, which may be a `translate` too, as with Tailwind's.
    root.animate([{ translate: `0 ${distance}px` }, { translate: "0 0" }], {
      duration: SLIDE_MS,
      easing: "ease-out",
      composite: "add",
    })
    cue.animate([{ opacity: 0 }, { opacity: 1 }], { duration: SLIDE_MS, easing: "ease-in" })
  }

  return (cue: Shown, lang: string, visible: boolean): boolean => {
    const previous = settings.previous ? cue.previous : undefined
    const key = JSON.stringify([lang, previous === undefined ? undefined : keyOf(previous), keyOf(cue)])
    if (key === shown) {
      const held = cue.held === true
      if (current === undefined || (current.element.dataset.held !== undefined) === held) {
        return false
      }
      current.element.toggleAttribute("data-held", held)
      return true
    }
    shown = key
    root.lang = lang
    const element = cueOf(cue, lang)
    element.toggleAttribute("data-held", cue.held === true)
    const ended = current
    current = { key: keyOf(cue), lang, element }
    if (
      previous !== undefined &&
      ended !== undefined &&
      ended.lang === lang &&
      ended.key === keyOf(previous)
    ) {
      // The cue that ended stays in the page rather than being drawn again, which would collapse a range on its words.
      const from = visible ? ended.element.getBoundingClientRect().bottom : undefined
      keepLastRow(ended.element)
      delete ended.element.dataset.held
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
