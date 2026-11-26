/** Anki: whether cards can be added, the AnkiConnect API key, and each language's deck and IPA choice. */
import { DEFAULT_ANKI_URL, type AnkiTarget } from "../anki/connect"
import { languageName } from "../languages"

/** A word's own language, like `de` for `de_en`. Decks go by it, whatever language the meanings are in. */
export type SourceLanguage = string

/** What each language's cards get. Languages the user never set are missing. */
export type AnkiLanguages = Record<SourceLanguage, { deck?: string; ipa?: boolean }>

export const ANKI_KEYS = ["ankiEnabled", "ankiKey", "ankiLanguages"]

const empty = {
  ankiEnabled: false,
  ankiLanguages: {} as AnkiLanguages,
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

const isAnkiLanguages = (value: unknown): value is AnkiLanguages =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(
    (choice) =>
      typeof choice === "object" &&
      choice !== null &&
      ["string", "undefined"].includes(typeof (choice as { deck?: unknown }).deck) &&
      ["boolean", "undefined"].includes(typeof (choice as { ipa?: unknown }).ipa),
  )

export const getAnkiLanguages = async (): Promise<AnkiLanguages> => {
  const { ankiLanguages } = await browser.storage.local.get("ankiLanguages")
  return isAnkiLanguages(ankiLanguages) ? ankiLanguages : empty.ankiLanguages
}

/** Merges `choice` into what `language` had. */
export const setAnkiLanguage = async (
  language: SourceLanguage,
  choice: { deck?: string; ipa?: boolean },
): Promise<void> => {
  const languages = await getAnkiLanguages()
  const had = Object.hasOwn(languages, language) ? languages[language] : {}
  await browser.storage.local.set({ ankiLanguages: { ...languages, [language]: { ...had, ...choice } } })
}

/** The deck a language's cards go to until the user picks one, like `DaDict::German`. */
export const defaultDeck = (language: SourceLanguage): string => `DaDict::${languageName(language)}`

/** The deck and IPA choice of `language`, with the defaults for what the user never set. */
export const ankiLanguage = (
  languages: AnkiLanguages,
  language: SourceLanguage,
): { deck: string; ipa: boolean } => {
  const choice = Object.hasOwn(languages, language) ? languages[language] : undefined
  return { deck: choice?.deck ?? defaultDeck(language), ipa: choice?.ipa ?? true }
}
