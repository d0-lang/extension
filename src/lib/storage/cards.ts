/**
 * Words kept from the popover to become Anki cards. Each is its own key, so the popover adding one and the review page
 * removing another never overwrite each other.
 */
import type { LookupEntry } from "../dict/types"
import type { LanguagePair } from "./servers"

/** What the card gets, as picked and edited on the review page. */
export type CardDraft = {
  /** Which of the seed's entries becomes the card. */
  entry: number
  /** Which of its senses, by index, in order. */
  senses: Array<number>
  /** A sense's text as edited, by its index. Others keep the server's glosses. */
  glosses?: Record<string, string>
  /** The sentence as edited, with `**` around the parts in bold. */
  sentence?: string
}

/**
 * What the popover had when the word was kept: what a card is made from. `entries` are the ones shown, and `entry`
 * the one kept. `draft` is unset until the meanings are picked.
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
  draft?: CardDraft
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

const isDraft = (value: unknown): value is CardDraft =>
  typeof (value as CardDraft | undefined)?.entry === "number" &&
  Array.isArray((value as CardDraft).senses) &&
  (value as CardDraft).senses.every((sense) => typeof sense === "number") &&
  ["string", "undefined"].includes(typeof (value as CardDraft).sentence) &&
  ((value as CardDraft).glosses === undefined ||
    (typeof (value as CardDraft).glosses === "object" &&
      (value as CardDraft).glosses !== null &&
      Object.values((value as CardDraft).glosses!).every((gloss) => typeof gloss === "string")))

/** Every kept word, oldest first. A malformed draft is dropped, not the word. */
export const getSeeds = async (): Promise<Array<CardSeed>> => {
  const all = await browser.storage.local.get(null)
  return Object.entries(all)
    .filter(([key, value]) => isSeedKey(key) && isSeed(value))
    .map(([, value]) => value as CardSeed)
    .map((seed) => (seed.draft === undefined || isDraft(seed.draft) ? seed : { ...seed, draft: undefined }))
    .sort((a, b) => a.added - b.added)
}

/** Stores `seed`, replacing the one with its id. */
export const addSeed = async (seed: CardSeed): Promise<void> => {
  await browser.storage.local.set({ [seedKey(seed.id)]: seed })
}

export const removeSeed = async (id: string): Promise<void> => {
  await browser.storage.local.remove(seedKey(id))
}
