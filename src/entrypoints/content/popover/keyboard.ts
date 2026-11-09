/** Popover keys: W/S scroll, A/D switch language, E plays the topmost pronunciation in view. */
import { isTyping } from "../hold"
import { suspendAccessKeys } from "./accesskeys"

// Physical keys, so they stay under the same fingers on any layout.
const languageSteps: Record<string, 1 | -1> = { KeyA: -1, KeyD: 1 }
const scrollSteps: Record<string, 1 | -1> = { KeyW: -1, KeyS: 1 }
const PLAY_KEY = "KeyE"

const SCROLL_PX_PER_MS = 0.6
/** A tap scrolls at least this far, however quickly the key comes up. */
const SCROLL_TAP_PX = 48

export type KeyActions = {
  /** The shown reply's scroller, unset while there is none. */
  scroller: () => HTMLElement | undefined
  /** False when there is no other language to switch to. */
  stepLanguage: (step: 1 | -1) => boolean
  play: (url: string) => void
}

/** Listen on the page until the returned function is called. Keys the popover uses do not reach the page. */
export const listenForKeys = ({ scroller, stepLanguage, play }: KeyActions): (() => void) => {
  /** Scrolling frame by frame, because repeated smooth `scrollBy` calls move at different speeds in Chrome and Firefox. */
  let scrolling:
    { code: string; step: 1 | -1; held: boolean; moved: number; last: number; frame: number } | undefined

  const stopScroll = () => {
    if (scrolling !== undefined) {
      cancelAnimationFrame(scrolling.frame)
    }
    scrolling = undefined
  }

  const scrollFrame = (now: number) => {
    const target = scroller()
    if (scrolling === undefined || target === undefined) {
      scrolling = undefined
      return
    }
    // A frame's timestamp can be a little older than the key press.
    const distance = Math.max(0, now - scrolling.last) * SCROLL_PX_PER_MS
    const before = target.scrollTop
    target.scrollTop = before + scrolling.step * distance
    scrolling.last = now
    scrolling.moved += Math.abs(target.scrollTop - before)
    const atEnd =
      scrolling.step === 1
        ? target.scrollTop + target.clientHeight >= target.scrollHeight - 1
        : target.scrollTop <= 0
    if (atEnd || (!scrolling.held && scrolling.moved >= SCROLL_TAP_PX)) {
      scrolling = undefined
      return
    }
    scrolling.frame = requestAnimationFrame(scrollFrame)
  }

  const startScroll = (code: string, step: 1 | -1): boolean => {
    if (scroller() === undefined) {
      return false
    }
    // Key repeats keep the scroll that the first press started.
    if (scrolling?.code !== code) {
      stopScroll()
      scrolling = {
        code,
        step,
        held: true,
        moved: 0,
        last: performance.now(),
        frame: requestAnimationFrame(scrollFrame),
      }
    }
    return true
  }

  /** The topmost entry with audio that is not scrolled out of view above. */
  const playShown = () => {
    const target = scroller()
    if (target === undefined) {
      return
    }
    const top = target.getBoundingClientRect().top
    const url = [...target.querySelectorAll<HTMLElement>("[data-audio]")].find(
      (section) => section.getBoundingClientRect().bottom > top,
    )?.dataset.audio
    if (url !== undefined) {
      play(url)
    }
  }

  const handleKey = (event: KeyboardEvent): boolean => {
    const languageStep = languageSteps[event.code]
    if (languageStep !== undefined) {
      return !event.repeat && stepLanguage(languageStep)
    }
    const scrollStep = scrollSteps[event.code]
    if (scrollStep !== undefined) {
      return startScroll(event.code, scrollStep)
    }
    if (event.code !== PLAY_KEY) {
      return false
    }
    if (!event.repeat) {
      playShown()
    }
    // Taken even without audio, so the page never sees E or Alt + E on words that have none.
    return true
  }

  const onKeyDown = (event: KeyboardEvent) => {
    // Alt stays allowed, because the popover is open while Alt is held.
    if (event.ctrlKey || event.metaKey || isTyping()) {
      return
    }
    if (handleKey(event)) {
      // Pages bind single letters too, like YouTube and Gmail.
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }
  const onKeyUp = (event: KeyboardEvent) => {
    if (scrolling?.code === event.code) {
      scrolling.held = false
    }
  }
  window.addEventListener("keydown", onKeyDown, { capture: true })
  window.addEventListener("keyup", onKeyUp, { capture: true })
  // The key-up goes unseen once focus leaves the page.
  window.addEventListener("blur", stopScroll)
  const restoreAccessKeys = suspendAccessKeys([
    ...Object.keys(languageSteps),
    ...Object.keys(scrollSteps),
    PLAY_KEY,
  ])
  return () => {
    restoreAccessKeys()
    window.removeEventListener("keydown", onKeyDown, { capture: true })
    window.removeEventListener("keyup", onKeyUp, { capture: true })
    window.removeEventListener("blur", stopScroll)
    stopScroll()
  }
}
