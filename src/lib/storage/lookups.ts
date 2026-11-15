/**
 * The last lookup in each tab that got an answer, kept so the popup can report it.
 * In session storage, because Chrome can stop the background at any time. One key per tab, so tabs do not race.
 */

/** `word` and `lang` as sent in the lookup, and the URL of the server that answered. */
export type LastLookup = { word: string; lang: string; server: string }

const lastLookupKey = (tabId: number) => `lastLookup:${tabId}`

const isLastLookup = (value: unknown): value is LastLookup =>
  typeof (value as LastLookup | undefined)?.word === "string" &&
  typeof (value as LastLookup).lang === "string" &&
  typeof (value as LastLookup).server === "string"

export const getLastLookup = async (tabId: number): Promise<LastLookup | undefined> => {
  const { [lastLookupKey(tabId)]: lookup } = await browser.storage.session.get(lastLookupKey(tabId))
  return isLastLookup(lookup) ? lookup : undefined
}

/** Stores only the three fields, whatever else `lookup` carries. */
export const setLastLookup = async (tabId: number, { word, lang, server }: LastLookup): Promise<void> => {
  await browser.storage.session.set({ [lastLookupKey(tabId)]: { word, lang, server } })
}

export const clearLastLookup = async (tabId: number): Promise<void> => {
  await browser.storage.session.remove(lastLookupKey(tabId))
}
