/** The mark on a player whose own subtitles a site's file stands in for, which hides them. */
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { REPLACING_ATTRIBUTE } from "$lib/subtitles/overlay"

/** How long a player stays marked after its file was last shown, so a frame without the subtitles shows none of its own. */
const HOLD_MS = 500

/**
 * Marks the player that `mark` is called with on each frame its file shows. The mark goes once the file has not shown
 * for a moment, as when the viewer turns the subtitles off, or once another player is marked.
 */
export const markReplacing = (ctx: ContentScriptContext): ((player: HTMLElement) => void) => {
  let marked: HTMLElement | undefined
  let unmark: number | undefined
  const clear = () => {
    marked?.removeAttribute(REPLACING_ATTRIBUTE)
    marked = undefined
  }
  ctx.onInvalidated(clear)
  return (player) => {
    if (marked !== player) {
      clear()
      marked = player
      player.setAttribute(REPLACING_ATTRIBUTE, "")
    }
    window.clearTimeout(unmark)
    unmark = ctx.setTimeout(clear, HOLD_MS)
  }
}
