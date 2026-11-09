/** Caption tracks the YouTube player downloads, passed from the page's own world to the content script. */

/** Dispatched on `window`, which both worlds share. The page can dispatch it too, so its detail is only data. */
export const TIMEDTEXT_EVENT = "dadict:timedtext"

export type Timedtext = { url: string; body: string }

/** A string, because an object made in one world does not reach the other whole in every browser. */
export const timedtextDetail = (timedtext: Timedtext): string => JSON.stringify(timedtext)
