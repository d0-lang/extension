/** Keeping words from the popover for Anki, on the page they were looked up on. */
import type { LookupEntry } from "../dict/types"
import { askInAnki } from "../messages"
import { addSeed, getSeeds, removeSeed, type CardSeed } from "../storage"

/** `kept` is waiting to become a card. `anki` is a card Anki has already. */
export type KeepState = "kept" | "anki"

/** What the popover shows when a word is kept. `entries` are the ones on screen, `entry` the one kept. */
export type Shown = {
  word: string
  followed: boolean
  lang: string
  server: string
  entries: Array<LookupEntry>
  entry: number
}

export type Keeping = {
  /** The state of each of `lemmas` in `lang` that is kept or in Anki. Others are missing. */
  states: (lang: string, lemmas: Array<string>) => Promise<Record<string, KeepState>>
  /** Keeps the entry, or lets it go when it is kept already. */
  toggle: (shown: Shown) => Promise<void>
}

const keptLemma = (seed: CardSeed): string | undefined => seed.entries[seed.entry]?.lemma

/** For a lookup in `sentence`, which a followed link's card does not get. */
export const createKeeping = (sentence: { text: string; at?: number } | undefined): Keeping => ({
  states: async (lang, lemmas) => {
    const [seeds, inAnki] = await Promise.all([getSeeds(), askInAnki(lemmas)])
    const kept = new Set(seeds.filter((seed) => seed.lang === lang).map(keptLemma))
    return Object.fromEntries(
      lemmas.flatMap((lemma): Array<[string, KeepState]> =>
        kept.has(lemma) ? [[lemma, "kept"]] : inAnki.includes(lemma) ? [[lemma, "anki"]] : [],
      ),
    )
  },
  toggle: async ({ word, followed, lang, server, entries, entry }) => {
    const lemma = entries[entry]?.lemma
    const kept = (await getSeeds()).filter((seed) => seed.lang === lang && keptLemma(seed) === lemma)
    if (kept.length > 0) {
      await Promise.all(kept.map((seed) => removeSeed(seed.id)))
      return
    }
    await addSeed({
      id: crypto.randomUUID(),
      added: Date.now(),
      word,
      lang,
      server,
      entries,
      entry,
      sentence: followed ? undefined : sentence,
      page: { url: location.href, title: document.title },
    })
  },
})
