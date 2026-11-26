/** Anki: whether cards can be added, the AnkiConnect API key, and each language's deck. */
import { DEFAULT_ANKI_URL, type AnkiTarget } from "../anki/connect"
import { languageName } from "../languages"

/** A word's own language, like `de` for `de_en`. Decks go by it, whatever language the meanings are in. */
export type SourceLanguage = string

/** The deck each language's cards go to. Languages the user never picked one for are missing. */
export type AnkiDecks = Record<SourceLanguage, string>

export const ANKI_KEYS = ["ankiEnabled", "ankiKey", "ankiDecks"]

const empty = {
  ankiEnabled: false,
  ankiDecks: {} as AnkiDecks,
}

export const getAnkiEnabled = async (): Promise<boolean> => {
  const { ankiEnabled } = await browser.storage.local.get("ankiEnabled")
  return typeof ankiEnabled === "boolean" ? ankiEnabled : empty.ankiEnabled
}

export const setAnkiEnabled = async (ankiEnabled: boolean): Promise<void> => {
  await browser.storage.local.set({ ankiEnabled })
}

/** Where AnkiConnect is, with the API key to send if the user set one in the add-on. */
export const getAnkiTarget = async (): Promise<AnkiTarget> => {
  const { ankiKey } = await browser.storage.local.get("ankiKey")
  return { url: DEFAULT_ANKI_URL, key: typeof ankiKey === "string" && ankiKey !== "" ? ankiKey : undefined }
}

export const setAnkiKey = async (ankiKey: string | undefined): Promise<void> => {
  await (ankiKey === undefined
    ? browser.storage.local.remove("ankiKey")
    : browser.storage.local.set({ ankiKey }))
}

const isAnkiDecks = (value: unknown): value is AnkiDecks =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((deck) => typeof deck === "string")

export const getAnkiDecks = async (): Promise<AnkiDecks> => {
  const { ankiDecks } = await browser.storage.local.get("ankiDecks")
  return isAnkiDecks(ankiDecks) ? ankiDecks : empty.ankiDecks
}

export const setAnkiDeck = async (language: SourceLanguage, deck: string): Promise<void> => {
  await browser.storage.local.set({ ankiDecks: { ...(await getAnkiDecks()), [language]: deck } })
}

/** The deck a language's cards go to until the user picks one, like `DaDict::German`. */
export const defaultDeck = (language: SourceLanguage): string => `DaDict::${languageName(language)}`

/** The deck `language`'s cards go to, the default one until the user picks one. */
export const deckFor = (decks: AnkiDecks, language: SourceLanguage): string =>
  Object.hasOwn(decks, language) ? decks[language]! : defaultDeck(language)
