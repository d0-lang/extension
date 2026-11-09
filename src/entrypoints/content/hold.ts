import type { ContentScriptContext } from "wxt/utils/content-script-context"
import type { WordHit } from "./page/pick"

/** Sweeping across a sentence must not send every word to a server. */
const SETTLE_MS = 120

const WHEEL_LINE_PX = 20

type HoldOptions = {
  isEnabled: () => boolean
  wordAt: (x: number, y: number) => WordHit | undefined
  isOverPopover: (x: number, y: number) => boolean
  popoverScroller: () => Element | undefined
  show: (hit: WordHit) => void
  close: () => void
}

/** A key press belongs to the page while focus is in a text field. */
export const isTyping = (): boolean => {
  const active = document.activeElement
  return (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    (active instanceof HTMLElement && active.isContentEditable)
  )
}

const wheelUnitPx = (deltaMode: number, scroller: Element): number => {
  switch (deltaMode) {
    case WheelEvent.DOM_DELTA_LINE:
      return WHEEL_LINE_PX
    case WheelEvent.DOM_DELTA_PAGE:
      return scroller.clientHeight
    default:
      return 1
  }
}

const hitKey = ({ word, anchor }: WordHit): string => `${word}@${anchor.left},${anchor.top}`

/**
 * While left Alt is held, show the word under the cursor.
 * Only left Alt counts, because AltGr types letters like `ą` and `ß` on many layouts.
 * Releasing closes the popover, unless the cursor is on it.
 * During a hold the wheel scrolls the popover wherever the cursor is, because Alt + wheel goes through history in Firefox.
 */
export const watchAltHold = (
  ctx: ContentScriptContext,
  { isEnabled, wordAt, isOverPopover, popoverScroller, show, close }: HoldOptions,
) => {
  let pointer: { x: number; y: number } | undefined
  let holding = false
  let frameQueued = false
  let shownKey: string | undefined
  let pendingKey: string | undefined
  let timer: number | undefined

  const cancelPending = () => {
    clearTimeout(timer)
    timer = undefined
    pendingKey = undefined
  }

  const showNow = (hit: WordHit, key: string) => {
    cancelPending()
    shownKey = key
    show(hit)
  }

  const update = (immediate: boolean) => {
    if (!holding || pointer === undefined) {
      return
    }
    if (isOverPopover(pointer.x, pointer.y)) {
      cancelPending()
      return
    }
    const hit = wordAt(pointer.x, pointer.y)
    // Reaching the popover crosses empty space, so only a new word replaces it.
    if (hit === undefined) {
      cancelPending()
      return
    }
    const key = hitKey(hit)
    if (key === shownKey) {
      cancelPending()
    } else if (immediate) {
      showNow(hit, key)
    } else if (key !== pendingKey) {
      // Moving within one word must not restart the wait.
      cancelPending()
      pendingKey = key
      timer = ctx.setTimeout(() => showNow(hit, key), SETTLE_MS)
    }
  }

  const release = (keepIfOverPopover: boolean) => {
    if (!holding) {
      return
    }
    holding = false
    window.removeEventListener("wheel", onWheel, { capture: true })
    cancelPending()
    if (!keepIfOverPopover || pointer === undefined || !isOverPopover(pointer.x, pointer.y)) {
      close()
    }
  }

  const onWheel = (event: WheelEvent) => {
    // The keyup can go unseen, like when Alt + Left leaves a page that later returns from the back/forward cache.
    if (!event.altKey) {
      release(true)
      return
    }
    event.preventDefault()
    const scroller = popoverScroller()
    if (scroller !== undefined) {
      const unit = wheelUnitPx(event.deltaMode, scroller)
      scroller.scrollBy(event.deltaX * unit, event.deltaY * unit)
    }
  }

  ctx.addEventListener(
    window,
    "pointermove",
    ({ clientX: x, clientY: y }) => {
      pointer = { x, y }
      if (holding && !frameQueued) {
        frameQueued = true
        ctx.requestAnimationFrame(() => {
          frameQueued = false
          update(false)
        })
      }
    },
    { capture: true, passive: true },
  )
  ctx.addEventListener(
    window,
    "keydown",
    (event) => {
      if (event.code === "AltLeft" && !event.repeat && isEnabled() && !isTyping()) {
        holding = true
        // Only during a hold, because a non-passive wheel listener makes every other scroll wait on this page's main thread.
        window.addEventListener("wheel", onWheel, { capture: true, passive: false, signal: ctx.signal })
        shownKey = undefined
        update(true)
      }
    },
    { capture: true },
  )
  ctx.addEventListener(
    window,
    "keyup",
    (event) => {
      if (event.code === "AltLeft" && holding) {
        // Firefox can open its menu bar when Alt is released.
        event.preventDefault()
        release(true)
      }
    },
    { capture: true },
  )
  // Alt-tabbing away means the page never sees the key come up.
  ctx.addEventListener(window, "blur", () => release(false))
}
