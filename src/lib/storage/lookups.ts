/**
 * The answer each tab's popover showed last, kept so the report page can report it, and the last one in any tab.
 * In session storage, because Chrome can stop the background at any time. One key per tab, so tabs do not race.
 */

/** `word` and `lang` as shown in the popover, and the URL of the server bound to `lang`. */
export type LastLookup = { word: string; lang: string; server: string }

/** Without a tab, the key of the last lookup in any tab. */
const lastLookupKey = (tabId: number | undefined) =>
  tabId === undefined ? "lastLookup" : `lastLookup:${tabId}`

const isLastLookup = (value: unknown): value is LastLookup =>
  typeof (value as LastLookup | undefined)?.word === "string" &&
  typeof (value as LastLookup).lang === "string" &&
  typeof (value as LastLookup).server === "string"

/** Without `tabId`, the last lookup in any tab, even one since closed. */
export const getLastLookup = async (tabId: number | undefined): Promise<LastLookup | undefined> => {
  const { [lastLookupKey(tabId)]: lookup } = await browser.storage.session.get(lastLookupKey(tabId))
  return isLastLookup(lookup) ? lookup : undefined
}

/** Stores only the three fields, whatever else `lookup` carries, for the tab and as the last in any tab. */
export const setLastLookup = async (tabId: number, { word, lang, server }: LastLookup): Promise<void> => {
  const lookup = { word, lang, server }
  await browser.storage.session.set({ [lastLookupKey(tabId)]: lookup, [lastLookupKey(undefined)]: lookup })
}

export const clearLastLookup = async (tabId: number): Promise<void> => {
  await browser.storage.session.remove(lastLookupKey(tabId))
}
