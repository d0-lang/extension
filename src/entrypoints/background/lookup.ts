/** Answers the content script's lookup requests. */
import { boundLanguages, lookupWord, rankLanguages, type LookupOutcome } from "$lib/dict"
import type { LookupReply, LookupRequestMessage } from "$lib/messages"
import { isSiteBlocked, setLastLookup, type LastLookup } from "$lib/storage"

/** What the report page's link needs of an answer: never the sentence or the page. Unset when no server answered. */
export const lastLookupOf = (
  word: string,
  { lang, server }: Pick<LookupOutcome, "lang" | "server">,
): LastLookup | undefined => (lang === undefined || server === undefined ? undefined : { word, lang, server })

const remember = (tabId: number | undefined, word: string, outcome: LookupOutcome) => {
  const lookup = lastLookupOf(word, outcome)
  if (tabId !== undefined && lookup !== undefined) {
    setLastLookup(tabId, lookup).catch((error) => console.warn("Could not keep the last lookup", error))
  }
}

/** `pageUrl` is the frame the word was picked in. Without one, the site counts as blocked. `tabId` is the tab it is in. */
export const answer = async (
  { word, hints, context }: LookupRequestMessage,
  pageUrl: string | undefined,
  tabId: number | undefined,
): Promise<LookupReply> => {
  const host = URL.parse(pageUrl ?? "")?.hostname
  const [{ languages, paused }, siteBlocked] = await Promise.all([
    boundLanguages().unwrapOr({ languages: [], paused: [] }),
    host === undefined ? true : isSiteBlocked(host),
  ])
  // The order `lookupWord` tries them in, since it ranks the same languages with the same hints.
  const tried = rankLanguages(languages, hints)
  return lookupWord(word, hints, context, siteBlocked).match(
    (outcome): LookupReply => {
      remember(tabId, word, outcome)
      return { ok: true, languages, paused, tried, ...outcome }
    },
    (error): LookupReply => ({ ok: false, languages, paused, tried, error }),
  )
}
