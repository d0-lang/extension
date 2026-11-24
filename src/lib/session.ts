/**
 * What a page remembers between lookups: the language the user picked, the last one that answered, and recent replies.
 * All of it ends with the page, so no list of visited sites gets stored.
 */
import type { LookupContext } from "$lib/dict/api"
import { requestLookup, type LookupReply } from "$lib/messages"
import { contextText, detectLanguages } from "./page/language"

const MAX_CACHED_REPLIES = 200

export const createSession = () => {
  let pinned: string | undefined
  let lastWorked: string | undefined
  const replies = new Map<string, LookupReply>()

  /**
   * `language` defaults to the pinned one. Without either, servers rank by `known`, the language the text is known to be in,
   * or else by the language detected around `element`.
   */
  const search = async (
    word: string,
    element: Element | null,
    language: string | undefined = pinned,
    context?: LookupContext,
    known?: string,
  ): Promise<LookupReply> => {
    const key = JSON.stringify([language, word, context, known])
    const cached = replies.get(key)
    if (cached !== undefined) {
      return cached
    }
    const reply = await requestLookup(
      word,
      {
        pinned: language,
        detected:
          language !== undefined
            ? []
            : known !== undefined
              ? [known]
              : await detectLanguages(contextText(element)),
        lastWorked,
      },
      context,
    )
    if (reply.ok && reply.lang !== undefined) {
      lastWorked = reply.lang
    }
    // A failure may be temporary, so only answers are kept.
    if (reply.ok) {
      replies.set(key, reply)
      for (const oldest of replies.keys()) {
        if (replies.size <= MAX_CACHED_REPLIES) {
          break
        }
        replies.delete(oldest)
      }
    }
    return reply
  }

  return {
    search,
    /** Make `language` the default for the rest of this page. Unset keeps the current one. */
    pin: (language: string | undefined): string | undefined => {
      pinned = language ?? pinned
      return pinned
    },
    // `de_en` is read as German. Unset until a language has answered on this page.
    locale: (): string | undefined => (pinned ?? lastWorked)?.split("_")[0],
    clearReplies: () => replies.clear(),
  }
}
