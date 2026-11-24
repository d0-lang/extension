/** The cue shown inside the player, in the page's own DOM so a word's sentence and Alt work on it as on any text. */
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import type { SubtitleSettings } from "$lib/storage"
import { createRows, type Shown } from "$lib/subtitles/rows"
import rowsCss from "$lib/subtitles/rows.css?inline"
import type { WordHit } from "../page/pick"
import { highlightRanges, type Paint } from "../popover/highlight"
import { safeArea, shiftInto } from "./area"
import { dragToMove } from "./drag"
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
  /**
   * A cue, lines apart with `\n`, with the row the cue before ended on above it. `undefined` hides the overlay until
   * the next cue. When the cue before is the one showing, that row slides up and keeps its words, so a lookup on one
   * stays open.
   */
  show: (cue: Shown | undefined, lang: string) => void
  contains: (event: Event) => boolean
  /** Whether `node` is in the subtitles. */
  holds: (node: Node) => boolean
  /**
   * Tints the words on the spans that hold them, so the tint is as tall as the line's background whatever font
   * draws them. A word the range only partly covers is tinted whole. The underline is a highlight, which sits on the
   * baseline in any font.
   */
  mark: Paint
  /** Puts the subtitles back where they start, after a drag. */
  resetPosition: () => void
  /** Whether the word `hit` is under the mark now. */
  isMarked: (hit: WordHit) => boolean
  remove: () => void
}

const addStyle = () => {
  if (document.getElementById(STYLE_ID) === null) {
    const style = document.createElement("style")
    style.id = STYLE_ID
    style.textContent = rowsCss + css
    document.head.append(style)
  }
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
  [...root.querySelectorAll("[data-line]")].flatMap((line) => {
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

/** Tints the words `ranges` cover in `root` until the returned function is called. */
const tint = (root: HTMLElement, ranges: ReadonlyArray<Range>): (() => void) => {
  const parts = coveredParts(root, ranges)
  for (const part of parts) {
    part.dataset.mark = "tint"
  }
  return () => {
    for (const part of parts) {
      delete part.dataset.mark
    }
  }
}

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

/**
 * Adds the overlay to `player`, which hides YouTube's own captions while it is there.
 * Dragging its text moves it around the player's safe area.
 */
export const createOverlay = (
  ctx: ContentScriptContext,
  player: HTMLElement,
  onWord: (hit: WordHit) => void,
  settings: SubtitleSettings,
): Overlay => {
  addStyle()
  const root = document.createElement("div")
  root.dataset.dadictCaptions = ""
  root.dataset.position = settings.position
  root.hidden = true
  player.append(root)

  /** Where the viewer dragged the subtitles, in fractions of the player's size from where they start. */
  let chosen = { x: 0, y: 0 }
  /** Where they are: `chosen`, moved as little as keeps the cue in the safe area. */
  let placed = chosen
  const moveTo = (offset: { x: number; y: number }) => {
    placed = offset
    root.style.setProperty("--dadict-caption-x", String(offset.x))
    root.style.setProperty("--dadict-caption-y", String(offset.y))
  }
  const place = () => {
    moveTo(chosen)
    // Where they start is clear of the title bar and controls already, and measuring a hidden overlay gives nothing.
    if (root.hidden || (chosen.x === 0 && chosen.y === 0)) {
      return
    }
    const shift = shiftInto(root.getBoundingClientRect(), safeArea(player))
    moveTo({ x: chosen.x + shift.x / player.clientWidth, y: chosen.y + shift.y / player.clientHeight })
  }
  dragToMove(ctx, root, () => {
    const from = placed
    return (dx, dy) => {
      chosen = { x: from.x + dx / player.clientWidth, y: from.y + dy / player.clientHeight }
      place()
    }
  })

  const resize = new ResizeObserver(() => {
    const size = Math.min(MAX_SIZE_PX, Math.max(MIN_SIZE_PX, player.clientHeight * SIZE_RATIO))
    root.style.setProperty("--dadict-caption-size", `${size}px`)
    // The title bar and controls fade out rather than leave the layout, so they can be measured while hidden.
    const box = player.getBoundingClientRect()
    const controls = player.querySelector(".ytp-chrome-bottom")
    if (controls !== null) {
      const lift = box.bottom - controls.getBoundingClientRect().top
      root.style.setProperty("--dadict-caption-lift", `${Math.max(0, lift)}px`)
    }
    // Players without a title, like the watch page's, keep the bar empty or hidden.
    const title = player.querySelector(".ytp-chrome-top")?.getBoundingClientRect()
    const drop = title === undefined || title.height === 0 ? 0 : title.bottom - box.top
    root.style.setProperty("--dadict-caption-drop", `${Math.max(0, drop)}px`)
    place()
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

  const rows = createRows(root, settings, place)
  let marked: ReadonlyArray<Range> = []

  return {
    player,
    show: (cue, lang) => {
      const visible = !root.hidden
      root.hidden = cue === undefined
      // A cue of another size can reach out of the safe area where the last one did not.
      if (cue !== undefined && !rows(cue, lang, visible) && !visible) {
        place()
      }
    },
    contains: (event) => event.composedPath().includes(root),
    holds: (node) => root.contains(node),
    // Always over the dark background. The next cue's text drops the tint with the spans.
    mark: (ranges, style) => {
      marked = ranges
      const unpaint = style === "underline" ? highlightRanges(ranges, style, true) : tint(root, ranges)
      return () => {
        if (marked === ranges) {
          marked = []
        }
        unpaint()
      }
    },
    // Ranges left on an earlier cue cannot be compared with this one's text.
    isMarked: (hit) =>
      isCovered(
        hit.element ?? undefined,
        marked.filter((range) => root.contains(range.commonAncestorContainer)),
      ),
    resetPosition: () => {
      chosen = { x: 0, y: 0 }
      place()
    },
    remove: () => {
      resize.disconnect()
      root.remove()
    },
  }
}
