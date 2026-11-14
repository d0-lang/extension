import type { LookupEntry, LookupSegment } from "./schemas"

/** Audio hosts any server may link, besides its own. */
const AUDIO_HOSTS: ReadonlyArray<string> = ["upload.wikimedia.org"]

const lemmaKey = (lemma: string): string => lemma.toLowerCase()

/** Entries whose lemma is `word` (as a `see` link names it), ignoring case. */
export const entriesForLemma = (entries: ReadonlyArray<LookupEntry>, word: string): Array<LookupEntry> =>
  entries.filter(({ lemma }) => lemmaKey(lemma) === lemmaKey(word))

/** A run of sense text. `target` is the `see` word it links to, if any. */
export type SensePart = { text: string; target: string | undefined }

// Words sit at even indexes and separators at odd ones, so joining the parts gives the text back.
const splitWords = (text: string): Array<string> => text.split(/([^\p{L}\p{M}\p{N}]+)/u)

const wordsOf = (text: string): Array<string> =>
  splitWords(lemmaKey(text)).filter((word, index) => index % 2 === 0 && word !== "")

/** True if `run` matches the words of `parts` from `start` on. Separators in between are not compared. */
const isRunAt = (parts: ReadonlyArray<string>, run: ReadonlyArray<string>, start: number): boolean =>
  run.every((word, offset) => lemmaKey(parts[start + offset * 2] ?? "") === word)

/**
 * Split `text` around whole-word, case-insensitive matches of the `see` words.
 * A single target that is not in the text links the whole text.
 * `unfound` keeps the other targets that matched nowhere, so they can be shown some other way.
 */
export const linkSense = (
  text: string,
  see: ReadonlyArray<string>,
): { parts: Array<SensePart>; unfound: Array<string> } => {
  const named = see.filter((word) => wordsOf(word).length > 0)
  const distinct = named.filter(
    (word, index) => named.findIndex((other) => lemmaKey(other) === lemmaKey(word)) === index,
  )
  // A target can start another one, like `mimo` and `mimo to`.
  const targets = distinct
    .map((target) => ({ target, run: wordsOf(target) }))
    .toSorted((a, b) => b.run.length - a.run.length)

  const words = splitWords(text)
  const parts: Array<SensePart> = []
  const found = new Set<string>()
  let plainFrom = 0
  let index = 0
  while (index < words.length) {
    const match = targets.find(({ run }) => isRunAt(words, run, index))
    if (match === undefined) {
      index += 2
      continue
    }
    const end = index + match.run.length * 2 - 1
    if (index > plainFrom) {
      parts.push({ text: words.slice(plainFrom, index).join(""), target: undefined })
    }
    parts.push({ text: words.slice(index, end).join(""), target: match.target })
    found.add(match.target)
    plainFrom = end
    index = end + 1
  }
  if (plainFrom < words.length) {
    parts.push({ text: words.slice(plainFrom).join(""), target: undefined })
  }

  const unfound = distinct.filter((target) => !found.has(target))
  if (distinct.length === 1 && unfound.length === 1) {
    return { parts: [{ text, target: unfound[0] }], unfound: [] }
  }
  return { parts, unfound }
}

/**
 * The word `segments` split. It is the first entry's `match` when that is one string containing `word`,
 * because a tokenizer for a script without spaces can give only a piece of the word. Otherwise it is `word`.
 */
export const splitWord = (entries: ReadonlyArray<LookupEntry>, word: string): string => {
  const match = entries[0]?.match
  return match?.length === 1 && match[0]!.includes(word) ? match[0]! : word
}

/**
 * True if `segments` follow the protocol for `word` and `entries`: their texts join exactly to the
 * `splitWord`, and every index points at an entry that no other segment claims.
 */
export const isValidSplit = (
  segments: ReadonlyArray<LookupSegment>,
  word: string,
  entries: ReadonlyArray<LookupEntry>,
): boolean => {
  const indexes = segments.flatMap(({ entries }) => entries ?? [])
  return (
    segments.map(({ text }) => text).join("") === splitWord(entries, word) &&
    new Set(indexes).size === indexes.length &&
    indexes.every((index) => index < entries.length)
  )
}

/** A segment with the entries its indexes point at. Without entries it has no meaning of its own. */
export type SegmentPart = { text: string; entries: Array<LookupEntry> }

/** `whole` are the entries in no segment, which belong to the whole word and come first. */
export const splitBySegments = (
  entries: ReadonlyArray<LookupEntry>,
  segments: ReadonlyArray<LookupSegment>,
): { whole: Array<LookupEntry>; parts: Array<SegmentPart> } => {
  const claimed = new Set(segments.flatMap((segment) => segment.entries ?? []))
  return {
    whole: entries.filter((_, index) => !claimed.has(index)),
    parts: segments.map(({ text, entries: indexes }) => ({
      text,
      entries: (indexes ?? []).flatMap((index) => entries[index] ?? []),
    })),
  }
}

/** Indexes of the parts that overlap `[start, end)` of the text they join to. */
export const partsCovering = (texts: ReadonlyArray<string>, start: number, end: number): Array<number> =>
  texts.flatMap((text, index) => {
    const from = texts.slice(0, index).join("").length
    return from < end && from + text.length > start ? [index] : []
  })

/** True only for `https` URLs on the host of `server`, the server that answered, or on the allowlist. */
export const isAllowedAudioUrl = (value: string, server: string | undefined): boolean => {
  const url = URL.parse(value)
  if (url === null || url.protocol !== "https:") {
    return false
  }
  return AUDIO_HOSTS.includes(url.host) || url.host === URL.parse(server ?? "")?.host
}

export type AudioItem = NonNullable<NonNullable<LookupEntry["pron"]>["audio"]>[number]

/** The recording the entry's play button plays: the first whose `url` the audio host rule allows. */
export const playableAudio = (entry: LookupEntry, server: string | undefined): AudioItem | undefined =>
  entry.pron?.audio?.find(({ url }) => isAllowedAudioUrl(url, server))
