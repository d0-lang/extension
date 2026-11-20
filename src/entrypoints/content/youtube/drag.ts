import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { keepPressFromPage } from "./press"

/** How far a press moves before it is a drag rather than a click on a word. */
const DRAG_THRESHOLD_PX = 4

/**
 * Makes a press on `root` that moves a drag. Once it moves, `start` runs and returns what follows the pointer, given
 * how far it is from where the press began. The rest of a drag, its click too, is kept from the words and the page.
 */
export const dragToMove = (
  ctx: ContentScriptContext,
  root: HTMLElement,
  start: () => (dx: number, dy: number) => void,
) => {
  // A press moves the subtitles rather than selecting their text.
  root.addEventListener("selectstart", (event) => event.preventDefault(), { signal: ctx.signal })
  root.addEventListener(
    "pointerdown",
    (down) => {
      if (down.button !== 0 || !down.isPrimary) {
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
