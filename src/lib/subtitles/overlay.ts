/** The cue shown inside the player, in the page's own DOM so a word's sentence and Alt work on it as on any text. */
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import type { SubtitleSettings } from "$lib/storage"
import { createRows, type Place, type Shown } from "$lib/subtitles/rows"
import rowsCss from "$lib/subtitles/rows.css?inline"
import type { WordHit } from "../page/pick"
import { highlightRanges, type Paint } from "../popover/highlight"
import { safeArea, shiftInto } from "./area"
import { dragToMove } from "./drag"
import type { Host } from "./host"
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
  host: Host
  /** The subtitles' own element in the player. */
  element: HTMLElement
  /**
   * A cue, lines apart with `\n`, with the row the cue before ended on above it. `undefined` hides the overlay until
   * the next cue. When the cue before is the one showing, that row slides up and keeps its words, so a lookup on one
   * stays open.
   */
  show: (cue: Shown | undefined, lang: string) => void
  /** The cue showing and its language, with the cue before only while it shows above. */
  shown: () => { cue: Shown; lang: string } | undefined
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
  /** Keeps the subtitles where they are, and the player's controls hidden, while a lookup of one of their words is open. */
  hold: (held: boolean) => void
  /** Whether the word `hit` is under the mark now. */
  isMarked: (hit: WordHit) => boolean
  remove: () => void
}

/**
 * Hides what the player draws its own subtitles in, its shade and what is in their way while the overlay is in it, and
 * its controls during a lookup. The controls go without the player's transition, which would show them for its length
 * first.
 */
const hostCss = ({ ownSubtitles, ownControls, ownShade, inTheWay }: Host): string => {
  const subtitles = `:has(> [data-dadict-captions]) :is(${ownSubtitles}) { display: none !important; }`
  const shaded = `:has(> [data-dadict-captions]) :is(${ownShade})`
  const shade = `${shaded}, ${shaded}::before, ${shaded}::after { background: none !important; }`
  // Hidden in place, so the controls beside it do not move.
  const way = `:has(> [data-dadict-captions]) :is(${inTheWay}) { visibility: hidden !important; }`
  const controls = `:has(> [data-dadict-captions][data-held]) :is(${ownControls}) { visibility: hidden !important; transition: none !important; }`
  return (
    (ownSubtitles === undefined ? "" : subtitles) +
    (ownShade === undefined ? "" : shade) +
    (inTheWay === undefined ? "" : way) +
    (ownControls === undefined ? "" : controls)
  )
}

const addStyle = (host: Host) => {
  if (document.getElementById(STYLE_ID) === null) {
    const style = document.createElement("style")
    style.id = STYLE_ID
    style.textContent = rowsCss + css + hostCss(host)
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
 * Adds the overlay to `player`, which hides the player's own subtitles while it is there.
 * Dragging its text moves it around the player's safe area.
 */
export const createOverlay = (
  ctx: ContentScriptContext,
  player: HTMLElement,
  host: Host,
  onWord: (hit: WordHit) => void,
  settings: SubtitleSettings,
): Overlay => {
  addStyle(host)
  const root = document.createElement("div")
  root.dataset.dadictCaptions = ""
  root.dataset.position = settings.position
  root.hidden = true
  player.append(root)

  /** Where the viewer dragged the subtitles, in fractions of the player's size from where they start. */
  let chosen = { x: 0, y: 0 }
  /** Whether the viewer dragged the subtitles, which then stay where they were dragged to. */
  let dragged = false
  /** Where the creator put the cue showing, when that is not where the track's cues mostly are. */
  let creatorPlace: Place | undefined
  /** Where they are: `chosen`, or the creator's place, moved as little as keeps the cue in the safe area. */
  let placed = chosen
  const moveTo = (offset: { x: number; y: number }) => {
    placed = offset
    root.style.setProperty("--dadict-caption-x", String(offset.x))
    root.style.setProperty("--dadict-caption-y", String(offset.y))
  }
  const anchorAt = (at: Place | undefined) => {
    root.toggleAttribute("data-anchor", at !== undefined)
    if (at !== undefined) {
      root.style.setProperty("--dadict-anchor-x", String(at.x))
      root.style.setProperty("--dadict-anchor-y", String(at.y))
      root.style.setProperty("--dadict-anchor-column", String(at.anchor % 3))
      root.style.setProperty("--dadict-anchor-row", String(Math.floor(at.anchor / 3)))
    }
  }
  /** The bars kept clear last, written only when they change. */
  let clear = { top: -1, bottom: -1 }
  const place = () => {
    const at = dragged ? undefined : creatorPlace
    anchorAt(at)
    const offset = at === undefined ? chosen : { x: 0, y: 0 }
    moveTo(offset)
    // Where they start is clear of the title bar and controls already, and measuring a hidden overlay gives nothing.
    if (root.hidden || (at === undefined && offset.x === 0 && offset.y === 0)) {
      return
    }
    // The bars kept clear, which a hold keeps as they were.
    const shift = shiftInto(
      root.getBoundingClientRect(),
      safeArea(player, clear.bottom < 0 ? host.bars(player) : clear),
    )
    moveTo({ x: offset.x + shift.x / player.clientWidth, y: offset.y + shift.y / player.clientHeight })
  }
  dragToMove(ctx, root, () => {
    if (!dragged && creatorPlace !== undefined) {
      // Carries on from the creator's place, as an offset from where the subtitles start.
      const at = root.getBoundingClientRect()
      dragged = true
      chosen = { x: 0, y: 0 }
      place()
      const start = root.getBoundingClientRect()
      chosen = {
        x: (at.left - start.left) / player.clientWidth,
        y: (at.top - start.top) / player.clientHeight,
      }
      place()
    }
    dragged = true
    const from = placed
    return (dx, dy) => {
      chosen = { x: from.x + dx / player.clientWidth, y: from.y + dy / player.clientHeight }
      place()
    }
  })

  /** Whether the pointer is on the subtitles. */
  let hovered = false
  /** Whether a lookup of one of their words is open. */
  let held = false
  root.addEventListener("pointerenter", () => {
    hovered = true
  })
  root.addEventListener("pointerleave", () => {
    hovered = false
  })
  /**
   * Keeps the subtitles clear of the player's bars. Whether that moved them. They stay put under the pointer or a
   * lookup, unless the player changed size: the player sees no pointer over them and hides its bars, and a lookup's
   * pause shows them, so they would move away from the pointer or out from under the popover.
   */
  const clearBars = (resized = false): boolean => {
    if (!resized && clear.bottom >= 0 && (hovered || held)) {
      return false
    }
    const bars = host.bars(player)
    if (bars.top === clear.top && bars.bottom === clear.bottom) {
      return false
    }
    clear = bars
    root.style.setProperty("--dadict-caption-lift", `${bars.bottom}px`)
    root.style.setProperty("--dadict-caption-drop", `${bars.top}px`)
    return true
  }

  const resize = new ResizeObserver(() => {
    const size = Math.min(MAX_SIZE_PX, Math.max(MIN_SIZE_PX, player.clientHeight * SIZE_RATIO))
    root.style.setProperty("--dadict-caption-size", `${size}px`)
    clearBars(true)
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
  let current: { cue: Shown; lang: string } | undefined

  return {
    player,
    host,
    element: root,
    show: (cue, lang) => {
      // Some players' bars show and hide, and the subtitles move with them.
      if (clearBars()) {
        place()
      }
      const visible = !root.hidden
      root.hidden = cue === undefined
      current = cue === undefined ? undefined : { cue, lang }
      creatorPlace = cue?.place
      // A cue of another size can reach out of the safe area where the last one did not.
      if (cue !== undefined && !rows(cue, lang, visible) && !visible) {
        place()
      }
    },
    shown: () =>
      current === undefined
        ? undefined
        : {
            ...current,
            cue: { ...current.cue, previous: settings.previous ? current.cue.previous : undefined },
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
    hold: (value) => {
      held = value
      root.toggleAttribute("data-held", value)
    },
    resetPosition: () => {
      chosen = { x: 0, y: 0 }
      dragged = false
      place()
    },
    remove: () => {
      resize.disconnect()
      root.remove()
    },
  }
}
