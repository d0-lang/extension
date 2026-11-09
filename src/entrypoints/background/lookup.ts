/** Answers the content script's lookup requests. */
import { boundLanguages, lookupWord, rankLanguages } from "$lib/dict"
import type { LookupReply, LookupRequestMessage } from "$lib/messages"
import { isSiteBlocked } from "$lib/storage"

/** `pageUrl` is the frame the word was picked in. Without one, the site counts as blocked. */
export const answer = async (
  { word, hints, context }: LookupRequestMessage,
  pageUrl: string | undefined,
): Promise<LookupReply> => {
  const host = URL.parse(pageUrl ?? "")?.hostname
  const [languages, siteBlocked] = await Promise.all([
    boundLanguages().unwrapOr([]),
    host === undefined ? true : isSiteBlocked(host),
  ])
  // The order `lookupWord` tries them in, since it ranks the same languages with the same hints.
  const tried = rankLanguages(languages, hints)
  return lookupWord(word, hints, context, siteBlocked).match(
    (outcome): LookupReply => ({ ok: true, languages, tried, ...outcome }),
    (error): LookupReply => ({ ok: false, languages, tried, error }),
  )
}
