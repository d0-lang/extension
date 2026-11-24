import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { keepPressFromPage } from "./press"

/** How far a press moves before it is a drag rather than a click on a word. */
const DRAG_THRESHOLD_PX = 4

/** The point in the text at `x` and `y`. Firefox and newer Chrome have a caret position, older Chrome a range. */
const caretAt = (x: number, y: number): { node: Node; offset: number } | undefined => {
  // The types have every browser give a caret position, which older Chrome does not.
  const position =
    typeof document.caretPositionFromPoint === "function" ? document.caretPositionFromPoint(x, y) : null
  if (position !== null) {
    return { node: position.offsetNode, offset: position.offset }
  }
  const range = document.caretRangeFromPoint(x, y)
  return range === null ? undefined : { node: range.startContainer, offset: range.startOffset }
}

/**
 * Starts the selection a press with Shift makes where the press is. Shift extends a selection, which would otherwise
 * reach back to wherever it was on the page, like the video's title. One already in `root` is extended as usual.
 */
const selectFrom = (root: HTMLElement, press: PointerEvent) => {
  const selection = getSelection()
  if (selection === null || (selection.anchorNode !== null && root.contains(selection.anchorNode))) {
    return
  }
  const caret = caretAt(press.clientX, press.clientY)
  if (caret === undefined) {
    selection.removeAllRanges()
  } else {
    selection.collapse(caret.node, caret.offset)
  }
}

/**
 * Makes a press on `root` that moves a drag. Once it moves, `start` runs and returns what follows the pointer, given
 * how far it is from where the press began. The rest of a drag, its click too, is kept from the words and the page.
 */
export const dragToMove = (
  ctx: ContentScriptContext,
  root: HTMLElement,
  start: () => (dx: number, dy: number) => void,
) => {
  // A press moves the subtitles rather than selecting their text, unless Shift is held.
  let selecting = false
  root.addEventListener(
    "selectstart",
    (event) => {
      if (!selecting) {
        event.preventDefault()
      }
    },
    { signal: ctx.signal },
  )
  root.addEventListener(
    "pointerdown",
    (down) => {
      selecting = down.shiftKey
      if (selecting) {
        selectFrom(root, down)
      }
      if (down.button !== 0 || !down.isPrimary || selecting) {
        return
      }
      const press = new AbortController()
      const signal = AbortSignal.any([press.signal, ctx.signal])
      let move: ((dx: number, dy: number) => void) | undefined
      window.addEventListener(
        "pointermove",
        (event) => {
          if (event.pointerId !== down.pointerId) {
            return
          }
          const dx = event.clientX - down.clientX
          const dy = event.clientY - down.clientY
          if (move === undefined) {
            if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
              return
            }
            keepPressFromPage(ctx, event)
            root.dataset.dragging = ""
            move = start()
          }
          move(dx, dy)
        },
        { capture: true, signal },
      )
      const end = (event: PointerEvent) => {
        if (event.pointerId === down.pointerId) {
          press.abort()
          delete root.dataset.dragging
        }
      }
      window.addEventListener("pointerup", end, { capture: true, signal })
      window.addEventListener("pointercancel", end, { capture: true, signal })
    },
    { signal: ctx.signal },
  )
}
