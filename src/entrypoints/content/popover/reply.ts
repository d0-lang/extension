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
export type Split = { whole: Array<LookupEntry>; parts: Array<SegmentPart>; clicked: Array<number> }

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
  const split = splitBySegments(result.entries, result.segments)
  if (split.parts.length < 2) {
    return undefined
  }
  const whole = splitWord(result.entries, word)
  if (whole === word) {
    return { ...split, clicked: [] }
  }
  const start = offsetIn?.(whole) ?? whole.indexOf(word)
  const texts = split.parts.map(({ text }) => text)
  return { ...split, clicked: partsCovering(texts, start, start + word.length) }
}

export const errorText = (error: DictError): string => {
  switch (error.kind) {
    case "no-server":
      return "No dictionary server is set up. Click the extension icon to add one."
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
