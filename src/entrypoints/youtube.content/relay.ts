/** Passes caption tracks on to the content script, which starts later than the page and can miss the player's first. */
import { TIMEDTEXT_EVENT, TIMEDTEXT_READY_EVENT, timedtextDetail } from "$lib/captions"

type Relay = Pick<Window, "addEventListener" | "dispatchEvent">

/**
 * Returns what dispatches a track on `win`. The tracks from before the content script says it listens
 * are kept, and dispatched again once it does.
 */
export const relayTimedtext = (win: Relay): ((url: string, body: string) => void) => {
  const dispatch = (detail: string) => win.dispatchEvent(new CustomEvent(TIMEDTEXT_EVENT, { detail }))
  let early: Array<string> | undefined = []
  win.addEventListener(
    TIMEDTEXT_READY_EVENT,
    () => {
      const missed = early ?? []
      early = undefined
      missed.forEach(dispatch)
    },
    { once: true },
  )
  return (url, body) => {
    const detail = timedtextDetail({ url, body })
    early?.push(detail)
    dispatch(detail)
  }
}
