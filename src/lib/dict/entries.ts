import type { LookupEntry } from "./schemas"

const AUDIO_HOSTS: ReadonlyArray<string> = ["upload.wikimedia.org"]

/** Entries that share a lowercase lemma and pos, with senses in server order. */
export type EntryGroup = {
  lemma: string
  pos: string
  ipa: Array<string>
  readings: Array<string>
  audio: Array<string>
  senses: LookupEntry["senses"]
}

const lemmaKey = (lemma: string): string => lemma.toLowerCase()

const unique = (values: ReadonlyArray<string>): Array<string> => [...new Set(values)]

/** Group per the protocol. A group keeps the spelling of its first entry. */
export const groupEntries = (entries: ReadonlyArray<LookupEntry>): Array<EntryGroup> => {
  const groups = new Map<string, EntryGroup>()
  for (const { lemma, pos, pron, senses } of entries) {
    const key = JSON.stringify([lemmaKey(lemma), pos])
    const group = groups.get(key) ?? { lemma, pos, ipa: [], readings: [], audio: [], senses: [] }
    group.ipa = unique([...group.ipa, ...(pron?.ipa ?? [])])
    group.readings = unique([...group.readings, ...(pron?.reading === undefined ? [] : [pron.reading])])
    group.audio = unique([...group.audio, ...(pron?.audio ?? [])])
    group.senses = [...group.senses, ...senses]
    groups.set(key, group)
  }
  return [...groups.values()]
}

/** Entries whose lemma is `word`, compared the way groups are. */
export const entriesForLemma = (
  entries: ReadonlyArray<LookupEntry>,
  word: string,
): Array<LookupEntry> => entries.filter(({ lemma }) => lemmaKey(lemma) === lemmaKey(word))

/** A run of sense text. `target` is the `see` word it links to, if any. */
export type SensePart = { text: string; target: string | undefined }

const escapeRegExp = (text: string): string => text.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&")

/**
 * Split `text` around whole-word, case-insensitive matches of the `see` words.
 * `unfound` keeps the words that matched nowhere, so they can be shown some other way.
 */
export const linkSense = (
  text: string,
  see: ReadonlyArray<string>,
): { parts: Array<SensePart>; unfound: Array<string> } => {
  const distinct = [...new Map(see.filter((word) => word.trim() !== "").map((word) => [lemmaKey(word), word])).values()]
  // A target can start another one, like `mimo` and `mimo to`.
  const targets = distinct.toSorted((a, b) => b.length - a.length)
  if (targets.length === 0) {
    return { parts: [{ text, target: undefined }], unfound: [] }
  }

  const groups = targets.map((target) => `(${escapeRegExp(target)})`).join("|")
  const matcher = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])(?:${groups})(?![\\p{L}\\p{M}\\p{N}])`, "giu")
  const parts: Array<SensePart> = []
  const found = new Set<string>()
  let end = 0
  for (const match of text.matchAll(matcher)) {
    const target = targets[match.slice(1).findIndex((group) => group !== undefined)]
    if (match.index > end) {
      parts.push({ text: text.slice(end, match.index), target: undefined })
    }
    parts.push({ text: match[0], target })
    if (target !== undefined) {
      found.add(target)
    }
    end = match.index + match[0].length
  }
  if (end < text.length) {
    parts.push({ text: text.slice(end), target: undefined })
  }
  return { parts, unfound: distinct.filter((word) => !found.has(word)) }
}

/** True only for `https` URLs whose host is on the allowlist. */
export const isAllowedAudioUrl = (value: string): boolean => {
  const url = URL.parse(value)
  return url !== null && url.protocol === "https:" && AUDIO_HOSTS.includes(url.host)
}
