/** Caption tracks the YouTube player downloads, passed from the page's own world to the content script. */

/** Dispatched on `window`, which both worlds share. The page can dispatch it too, so its detail is only data. */
export const TIMEDTEXT_EVENT = "dadict:timedtext"

export type Timedtext = { url: string; body: string }

/** Dispatched on `window` by the content script once it listens, since the player can download a track before that. */
export const TIMEDTEXT_READY_EVENT = "dadict:timedtext-ready"

/** On `<html>` while the extension shows YouTube's subtitles, so the page's world also undoes YouTube's language picks. */
export const ORIGINAL_ATTRIBUTE = "data-dadict-original"

/** A string, because an object made in one world does not reach the other whole in every browser. */
export const timedtextDetail = (timedtext: Timedtext): string => JSON.stringify(timedtext)
