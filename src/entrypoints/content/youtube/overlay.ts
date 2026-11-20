/** The cue shown inside the player, in the page's own DOM so a word's sentence and Alt work on it as on any text. */
import type { WordHit } from "../page/pick"
import { segmentsOf } from "../page/tokenize"
import { highlightRanges, type Paint } from "../popover/highlight"
import css from "./overlay.css?inline"

const STYLE_ID = "dadict-captions-style"

/** Of the player's height, like YouTube's own captions. */
const SIZE_RATIO = 0.045
const MIN_SIZE_PX = 14
const MAX_SIZE_PX = 44

/** Kept from the player, which would take them as play, pause, fullscreen or a drag. */
const SWALLOWED = [
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "click",
  "dblclick",
  "touchstart",
  "touchend",
]

export type Overlay = {
  player: HTMLElement
  /** A cue's text, lines apart with `\n`. `undefined` hides the overlay until the next cue. */
  show: (text: string | undefined, lang: string) => void
  contains: (event: Event) => boolean
  /** Whether `node` is in the subtitles. */
  holds: (node: Node) => boolean
  /**
   * Tints the words on the spans that hold them, so the tint is as tall as the line's background whatever font
   * draws them. A word the range only partly covers is tinted whole. The underline is a highlight, which sits on the
   * baseline in any font.
   */
  mark: Paint
  remove: () => void
}

const addStyle = () => {
  if (document.getElementById(STYLE_ID) === null) {
    const style = document.createElement("style")
    style.id = STYLE_ID
    style.textContent = css
    document.head.append(style)
  }
}

/**
 * A line with each word in its own span, so hovering and clicking a word need no hit testing.
 * What is between words gets a span too, so a mark over a phrase has no gaps.
 */
const lineOf = (text: string, lang: string): HTMLElement => {
  const line = document.createElement("span")
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

/** Whether `range` covers some of `text`, not only touches it. */
const overlaps = (range: Range, text: Text): boolean => {
  const whole = document.createRange()
  whole.selectNodeContents(text)
  return (
    range.compareBoundaryPoints(Range.END_TO_START, whole) < 0 &&
    range.compareBoundaryPoints(Range.START_TO_END, whole) > 0
  )
}

const isCovered = (part: Element | undefined, ranges: ReadonlyArray<Range>): boolean =>
  part instanceof HTMLElement &&
  part.dataset.word !== undefined &&
  part.firstChild instanceof Text &&
  ranges.some((range) => overlaps(range, part.firstChild as Text))

/** The words `ranges` cover in `root`, and what is between two of them on a line. */
const coveredParts = (root: HTMLElement, ranges: ReadonlyArray<Range>): Array<HTMLElement> =>
  [...root.children].flatMap((line) => {
    const parts = [...line.children]
    return parts.filter(
      (part, index): part is HTMLElement =>
        isCovered(part, ranges) ||
        (part instanceof HTMLElement &&
          part.dataset.word === undefined &&
          isCovered(parts[index - 1], ranges) &&
          isCovered(parts[index + 1], ranges)),
    )
  })

const hitOn = (word: HTMLElement): WordHit | undefined => {
  const text = word.firstChild
  if (!(text instanceof Text)) {
    return undefined
  }
  const range = document.createRange()
  range.setStart(text, 0)
  range.setEnd(text, text.length)
  const { top, bottom, left, right } = range.getBoundingClientRect()
  return { word: text.data, anchor: { top, bottom, left, right }, element: word, range }
}

/**
 * Removes the overlays and style an earlier run of the content script left on the page, so the style is this run's.
 * Firefox drops a reloaded extension's scripts without running their cleanup.
 */
export const removeLeftovers = () => {
  for (const root of document.querySelectorAll("[data-dadict-captions]")) {
    root.remove()
  }
  document.getElementById(STYLE_ID)?.remove()
}

/** Adds the overlay to `player`, which hides YouTube's own captions while it is there. */
export const createOverlay = (player: HTMLElement, onWord: (hit: WordHit) => void): Overlay => {
  addStyle()
  const root = document.createElement("div")
  root.dataset.dadictCaptions = ""
  root.hidden = true
  player.append(root)

  const resize = new ResizeObserver(() => {
    const size = Math.min(MAX_SIZE_PX, Math.max(MIN_SIZE_PX, player.clientHeight * SIZE_RATIO))
    root.style.setProperty("--dadict-caption-size", `${size}px`)
    // The controls fade out rather than leave the layout, so they can be measured while hidden.
    const controls = player.querySelector(".ytp-chrome-bottom")
    if (controls !== null) {
      const lift = player.getBoundingClientRect().bottom - controls.getBoundingClientRect().top
      root.style.setProperty("--dadict-caption-lift", `${Math.max(0, lift)}px`)
    }
  })
  resize.observe(player)

  for (const type of SWALLOWED) {
    root.addEventListener(type, (event) => event.stopPropagation())
  }
  root.addEventListener("click", (event) => {
    const word = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-word]") : null
    const hit = word === null ? undefined : hitOn(word)
    if (hit !== undefined) {
      onWord(hit)
    }
  })

  let shown = ""
  return {
    player,
    show: (text, lang) => {
      root.hidden = text === undefined
      const key = `${lang}\n${text}`
      if (text === undefined || key === shown) {
        return
      }
      shown = key
      root.lang = lang
      // A line break in the text, which `pre-line` shows. A `<br>` or a block per line would end the text
      // a word's sentence is read from, and the server should get the whole cue.
      root.replaceChildren(
        ...text
          .split("\n")
          .flatMap((line, index): Array<string | Node> => [
            ...(index === 0 ? [] : ["\n"]),
            lineOf(line, lang),
          ]),
      )
    },
    contains: (event) => event.composedPath().includes(root),
    holds: (node) => root.contains(node),
    // Always over the dark background. The next cue's text drops the tint with the spans.
    mark: (ranges, style) => {
      if (style === "underline") {
        return highlightRanges(ranges, style, true)
      }
      const parts = coveredParts(root, ranges)
      for (const part of parts) {
        part.dataset.mark = style
      }
      return () => {
        for (const part of parts) {
          delete part.dataset.mark
        }
      }
    },
    remove: () => {
      resize.disconnect()
      root.remove()
    },
  }
}
