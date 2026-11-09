/** The cue shown inside the player, in the page's own DOM so picking a word, its sentence and Alt work on it as on any text. */
import type { WordHit } from "../page/pick"
import css from "./overlay.css?inline"

const STYLE_ID = "dadict-captions-style"
const HOVER = "dadict-caption-hover"

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

type OverlayOptions = {
  wordAt: (x: number, y: number) => WordHit | undefined
  onWord: (hit: WordHit) => void
}

export type Overlay = {
  player: HTMLElement
  /** `undefined` hides the overlay until the next cue. */
  show: (text: string | undefined, lang: string) => void
  contains: (event: Event) => boolean
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

const clearHover = () => CSS.highlights?.delete(HOVER)

/** Adds the overlay to `player`, which hides YouTube's own captions while it is there. */
export const createOverlay = (player: HTMLElement, { wordAt, onWord }: OverlayOptions): Overlay => {
  addStyle()
  const root = document.createElement("div")
  root.dataset.dadictCaptions = ""
  root.hidden = true
  const line = document.createElement("span")
  root.append(line)
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
    line.addEventListener(type, (event) => event.stopPropagation())
  }
  line.addEventListener("click", (event) => {
    const hit = wordAt(event.clientX, event.clientY)
    if (hit !== undefined) {
      onWord(hit)
    }
  })
  line.addEventListener("pointermove", (event) => {
    const hit = wordAt(event.clientX, event.clientY)
    if (hit === undefined) {
      clearHover()
    } else {
      CSS.highlights?.set(HOVER, new Highlight(hit.range))
    }
  })
  line.addEventListener("pointerleave", clearHover)

  let shown: string | undefined
  return {
    player,
    show: (text, lang) => {
      root.hidden = text === undefined
      if (text !== undefined && (text !== shown || root.lang !== lang)) {
        shown = text
        root.lang = lang
        line.textContent = text
        // The highlighted word went with the old text.
        clearHover()
      }
    },
    contains: (event) => event.composedPath().includes(root),
    remove: () => {
      resize.disconnect()
      clearHover()
      root.remove()
    },
  }
}
