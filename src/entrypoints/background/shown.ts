/** Keeps the lookup each tab's popover shows, for the report page, and ticks the first one off in Get started. */
import type { ShownLookupMessage } from "$lib/messages"
import { getServerByLang, markLookedUp, setLastLookup } from "$lib/storage"

/**
 * Stores `word` and `lang` against the server bound to `lang`, never the sentence or the page.
 * Nothing is stored without a tab, or once `lang` is no longer bound.
 */
export const rememberShown = async ({ word, lang }: ShownLookupMessage, tabId: number | undefined) => {
  const server = (await getServerByLang())[lang]
  if (tabId !== undefined && server !== undefined) {
    await Promise.all([setLastLookup(tabId, { word, lang, server }), markLookedUp()])
  }
}
