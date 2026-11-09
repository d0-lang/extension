/** What the popover shows for a reply: its language, its entries, how a split word divides, and error text. */
import {
  entriesForLemma,
  partsCovering,
  splitBySegments,
  splitWord,
  type SegmentPart,
} from "$lib/dict/entries"
import type { DictError } from "$lib/dict/errors"
import type { LookupEntry } from "$lib/dict/types"
import type { LookupReply } from "$lib/messages"

/** `clicked` are the parts the looked-up word is in, when the split is of a longer word around it. */
export type Split = { parts: Array<SegmentPart>; clicked: Array<number> }

/** The first part with entries, which holds the whole word's own entries when there are any. */
export const firstTab = (split: Split): number => split.parts.findIndex((part) => part.entries.length > 0)

/** The language that answered, or the only one asked when it did not. Unset when several were asked and none answered. */
export const shownLanguage = (result: LookupReply): string | undefined =>
  (result.ok ? result.lang : undefined) ?? (result.tried.length === 1 ? result.tried[0] : undefined)

/** A followed link shows only the entries whose lemma is `word`. */
export const shownEntries = (result: LookupReply, word: string, followed: boolean): Array<LookupEntry> => {
  if (!result.ok) {
    return []
  }
  return followed ? entriesForLemma(result.entries, word) : result.entries
}

/**
 * The whole word's own entries go first in the first part, so they show before any tab is picked.
 * Unset for a followed link, whose entries no longer line up with the indexes, and for a split into one part.
 * `offsetIn` finds where `word` starts inside the longer word around it, when it can tell.
 */
export const shownSplit = (
  result: LookupReply,
  word: string,
  followed: boolean,
  offsetIn: ((part: string) => number | undefined) | undefined,
): Split | undefined => {
  if (!result.ok || followed || result.segments === undefined) {
    return undefined
  }
  const { whole: wholeEntries, parts } = splitBySegments(result.entries, result.segments)
  const [first, ...rest] = parts
  if (first === undefined || rest.length === 0) {
    return undefined
  }
  const merged = [{ ...first, entries: [...wholeEntries, ...first.entries] }, ...rest]
  const whole = splitWord(result.entries, word)
  if (whole === word) {
    return { parts: merged, clicked: [] }
  }
  const start = offsetIn?.(whole) ?? whole.indexOf(word)
  const texts = parts.map(({ text }) => text)
  return { parts: merged, clicked: partsCovering(texts, start, start + word.length) }
}

/** Why a miss may not be one: the languages it skipped because their server is paused. */
export const pausedText = (paused: Array<string>): string =>
  `Not checked in ${paused.join(", ")}, paused until you review ${paused.length === 1 ? "its server" : "their servers"} in DaDict settings.`

export const errorText = (error: DictError): string => {
  switch (error.kind) {
    case "no-server":
      return "No dictionary server is set up. Click the extension icon to add one."
    case "paused":
      return "Lookups are paused until you review the dictionary server in DaDict settings."
    case "network":
      return "Could not reach the dictionary server."
    case "http":
      return "The dictionary server returned an error."
    case "bad-request":
      return "The dictionary server rejected this request."
    case "unsupported-lang":
      return "The dictionary server does not support this language."
    default:
      return "The dictionary server sent an unexpected response."
  }
}
