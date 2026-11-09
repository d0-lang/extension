/** The cue shown inside the player, in the page's own DOM so a word's sentence and Alt work on it as on any text. */
import type { WordHit } from "../page/pick"
import { segmentsOf } from "../page/tokenize"
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

/** A line with each word in its own span, so hovering and clicking a word need no hit testing. */
const lineOf = (text: string, lang: string): HTMLElement => {
  const line = document.createElement("span")
  for (const segment of segmentsOf(text, lang)) {
    if (segment.word) {
      const word = document.createElement("span")
      word.dataset.word = ""
      word.textContent = segment.text
      line.append(word)
    } else {
      line.append(segment.text)
    }
  }
  return line
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
      // A break, not a block per line, so the sentence around a word can run on from the line above.
      root.replaceChildren(
        ...text
          .split("\n")
          .flatMap((line, index) => [
            ...(index === 0 ? [] : [document.createElement("br")]),
            lineOf(line, lang),
          ]),
      )
    },
    contains: (event) => event.composedPath().includes(root),
    remove: () => {
      resize.disconnect()
      root.remove()
    },
  }
}
