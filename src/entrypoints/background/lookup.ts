/** Answers the content script's lookup requests. */
import { boundLanguages, lookupWord, rankLanguages } from "$lib/dict"
import type { LookupReply, LookupRequestMessage } from "$lib/messages"
import { isSiteBlocked } from "$lib/storage"

/**
 * The host of the frame a message came from. A frame without one of its own, like `about:blank`, has the origin of
 * the page that made it. Unset when neither says, like for a sandboxed frame.
 */
export const senderHost = ({ url, origin }: { url?: string; origin?: string }): string | undefined =>
  URL.parse(url ?? "")?.hostname || URL.parse(origin ?? "")?.hostname || undefined

/** `host` is the frame the word was picked in. Without one, the site counts as blocked. */
export const answer = async (
  { word, hints, context }: LookupRequestMessage,
  host: string | undefined,
): Promise<LookupReply> => {
  const [{ languages, paused }, siteBlocked] = await Promise.all([
    boundLanguages().unwrapOr({ languages: [], paused: [] }),
    host === undefined ? true : isSiteBlocked(host),
  ])
  // The order `lookupWord` tries them in, since it ranks the same languages with the same hints.
  const tried = rankLanguages(languages, hints)
  return lookupWord(word, hints, context, siteBlocked).match(
    (outcome): LookupReply => ({ ok: true, languages, paused, tried, ...outcome }),
    (error): LookupReply => ({ ok: false, languages, paused, tried, error }),
  )
}
