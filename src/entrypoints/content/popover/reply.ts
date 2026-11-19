/** What the popover shows for a reply: its language, its entries, how a split word divides, and error text. */
import {
  entriesForLemma,
  partsCovering,
  splitBySegments,
  splitWord,
  type SegmentPart,
} from "$lib/dict/entries"
import type { DictError } from "$lib/dict/errors"
import type { LookupEntry, LookupSegment } from "$lib/dict/types"
import type { LookupReply } from "$lib/messages"

/**
 * `clicked` are the parts the looked-up word is in, when the split is of a longer word around it.
 * `opens` is the main part, which the popover opens on.
 * `whole` is how many of the main part's entries, from the top, are the whole word's own.
 */
export type Split = { parts: Array<SegmentPart>; clicked: Array<number>; opens: number; whole: number }

/** How many of `tab`'s entries, from the top, to set apart as the whole word's own. None when they are all it holds. */
export const wholeOnTop = (split: Split, tab: number): number =>
  tab === split.opens && (split.parts[tab]?.entries.length ?? 0) > split.whole ? split.whole : 0

/**
 * The segment holding the lowest entry index, since the server ranks first the piece that carries
 * the meaning (`ninakupenda` opens on `pend`, `l'homme` on `homme`). The first one when none has entries.
 */
const mainSegment = (segments: ReadonlyArray<LookupSegment>): number => {
  const first = Math.min(...segments.flatMap((segment) => segment.entries ?? []))
  return Math.max(
    segments.findIndex((segment) => segment.entries?.includes(first) === true),
    0,
  )
}

/** The parts that have entries, which are the ones that can be picked. */
export const pickableParts = (split: Split): Array<number> =>
  split.parts.flatMap((part, index) => (part.entries.length > 0 ? [index] : []))

/** The part to pick after `tab` in the direction of `step`, wrapping around. Unset with fewer than two parts to pick. */
export const steppedTab = (split: Split, tab: number, step: 1 | -1): number | undefined => {
  const pickable = pickableParts(split)
  if (pickable.length < 2) {
    return undefined
  }
  return step === 1
    ? (pickable.find((index) => index > tab) ?? pickable[0])
    : (pickable.findLast((index) => index < tab) ?? pickable.at(-1))
}

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
 * The whole word's own entries go first in the main part, so they show before any tab is picked.
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
  if (parts.length < 2) {
    return undefined
  }
  const opens = mainSegment(result.segments)
  const merged = parts.map((part, index) =>
    index === opens ? { ...part, entries: [...wholeEntries, ...part.entries] } : part,
  )
  const shown = { parts: merged, opens, whole: wholeEntries.length }
  const whole = splitWord(result.entries, word)
  if (whole === word) {
    return { ...shown, clicked: [] }
  }
  const start = offsetIn?.(whole) ?? whole.indexOf(word)
  const texts = parts.map(({ text }) => text)
  return { ...shown, clicked: partsCovering(texts, start, start + word.length) }
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
