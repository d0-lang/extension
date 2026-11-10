/** Passes caption tracks on to the content script, which starts later than the page and can miss the player's first. */
import { TIMEDTEXT_EVENT, TIMEDTEXT_READY_EVENT, timedtextDetail } from "$lib/captions"

type Relay = Pick<Window, "addEventListener" | "dispatchEvent">

/** Enough for the video on the page and a few played before it or on hover. */
const MAX_KEPT = 5

/**
 * Returns what dispatches a track on `win`. The latest tracks are kept, and dispatched again whenever a content script
 * says it listens. That is once on a page load, and again when the extension reloads under an open page.
 */
export const relayTimedtext = (win: Relay): ((url: string, body: string) => void) => {
  const dispatch = (detail: string) => win.dispatchEvent(new CustomEvent(TIMEDTEXT_EVENT, { detail }))
  const kept: Array<string> = []
  win.addEventListener(TIMEDTEXT_READY_EVENT, () => kept.forEach(dispatch))
  return (url, body) => {
    const detail = timedtextDetail({ url, body })
    kept.push(detail)
    if (kept.length > MAX_KEPT) {
      kept.shift()
    }
    dispatch(detail)
  }
}
