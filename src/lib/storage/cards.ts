/**
 * Words kept from the popover to become Anki cards. Each is its own key, so the popover adding one and the review page
 * removing another never overwrite each other.
 */
import type { LookupEntry } from "../dict/types"
import type { LanguagePair } from "./servers"

/**
 * What the popover had when the word was kept, before anyone picks its meanings: what a card is made from.
 * `entries` are the ones shown, and `entry` the one kept.
 */
export type CardSeed = {
  id: string
  /** When it was kept, in ms since the epoch. */
  added: number
  /** The word as looked up, which a followed link replaces. */
  word: string
  lang: LanguagePair
  /** The server that answered, whose own host may serve the audio. */
  server: string
  entries: Array<LookupEntry>
  entry: number
  /** The sentence the word was looked up in, and which copy of it. Unset for a followed link. */
  sentence?: { text: string; at?: number }
  page: { url: string; title: string }
}

const PREFIX = "card:"

const seedKey = (id: string) => `${PREFIX}${id}`

/** Whether a storage key is a kept word's. */
export const isSeedKey = (key: string): boolean => key.startsWith(PREFIX)

const isSeed = (value: unknown): value is CardSeed =>
  typeof (value as CardSeed | undefined)?.id === "string" &&
  typeof (value as CardSeed).word === "string" &&
  typeof (value as CardSeed).lang === "string" &&
  Array.isArray((value as CardSeed).entries) &&
  typeof (value as CardSeed).entry === "number"

/** Every kept word, oldest first. */
export const getSeeds = async (): Promise<Array<CardSeed>> => {
  const all = await browser.storage.local.get(null)
  return Object.entries(all)
    .filter(([key, value]) => isSeedKey(key) && isSeed(value))
    .map(([, value]) => value as CardSeed)
    .sort((a, b) => a.added - b.added)
}

export const addSeed = async (seed: CardSeed): Promise<void> => {
  await browser.storage.local.set({ [seedKey(seed.id)]: seed })
}

export const removeSeed = async (id: string): Promise<void> => {
  await browser.storage.local.remove(seedKey(id))
}
