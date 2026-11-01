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

const unique = (values: ReadonlyArray<string>): Array<string> => [...new Set(values)]

/** Group per the protocol. A group keeps the spelling of its first entry. */
export const groupEntries = (entries: ReadonlyArray<LookupEntry>): Array<EntryGroup> => {
  const groups = new Map<string, EntryGroup>()
  for (const { lemma, pos, pron, senses } of entries) {
    const key = JSON.stringify([lemma.toLowerCase(), pos])
    const group = groups.get(key) ?? { lemma, pos, ipa: [], readings: [], audio: [], senses: [] }
    group.ipa = unique([...group.ipa, ...(pron?.ipa ?? [])])
    group.readings = unique([...group.readings, ...(pron?.reading === undefined ? [] : [pron.reading])])
    group.audio = unique([...group.audio, ...(pron?.audio ?? [])])
    group.senses = [...group.senses, ...senses]
    groups.set(key, group)
  }
  return [...groups.values()]
}

/** True only for `https` URLs whose host is on the allowlist. */
export const isAllowedAudioUrl = (value: string): boolean => {
  const url = URL.parse(value)
  return url !== null && url.protocol === "https:" && AUDIO_HOSTS.includes(url.host)
}
