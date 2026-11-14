import type { ContentScriptContext } from "wxt/utils/content-script-context"

/** What follows `pointerdown` in one press, from a mouse or a touch. */
const PRESS_EVENTS = ["touchstart", "pointerup", "touchend", "mousedown", "mouseup", "click"]

/** How long after the press lifts its `click` may still come. */
const CLICK_WAIT_MS = 500

/**
 * Keeps the press that `event` starts from the page, up to its `click`.
 * If no `click` comes soon after the press lifts, it stops, so a later key that clicks still gets through.
 */
export const keepPressFromPage = (ctx: ContentScriptContext, event: PointerEvent) => {
  event.stopPropagation()
  const press = new AbortController()
  const signal = AbortSignal.any([press.signal, ctx.signal])
  const end = () => press.abort()
  for (const type of PRESS_EVENTS) {
    window.addEventListener(
      type,
      (next) => {
        next.stopPropagation()
        if (type === "click") {
          end()
        } else if (type === "pointerup") {
          ctx.setTimeout(end, CLICK_WAIT_MS)
        }
      },
      { capture: true, signal },
    )
  }
}
