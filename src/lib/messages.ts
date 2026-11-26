/** Messages between the background script and the content script's popover. */
import { ResultAsync, err, ok } from "neverthrow"
import type { LookupContext } from "./dict/api"
import { fromUnknown, type DictError } from "./dict/errors"
import type { LookupOutcome } from "./dict/lookup"
import type { LookupHints } from "./dict/rank"

/** Background to content: the context menu item was pressed in this frame. */
export type OpenLookupMessage = { type: "lookup:open"; selectionText: string | undefined }

/** Content to background: fetch this word. `context` is the sentence around it, and the background decides which servers get it. */
export type LookupRequestMessage = {
  type: "lookup:request"
  word: string
  hints: LookupHints
  context: LookupContext | undefined
}

/**
 * Plain data, because a `Result` does not survive messaging. `languages` are the bound ones a lookup can ask.
 * `paused` are bound but skipped until the user resolves their server's issue.
 * `tried` are the languages asked, in order, whether or not one answered.
 */
export type LookupReply = { languages: Array<string>; paused: Array<string>; tried: Array<string> } & (
  ({ ok: true } & LookupOutcome) | { ok: false; error: DictError }
)

/** Content to background: the popover shows `word`, answered or missed in `lang`, which the report page then offers. */
export type ShownLookupMessage = { type: "lookup:shown"; word: string; lang: string }

/** Content to background: fetch the recording at `url`, so the request carries nothing of the page. */
export type AudioRequestMessage = { type: "audio:request"; url: string }

/** The recording's bytes in base64, because Chrome sends messages as JSON. */
export type AudioReply = { ok: true; data: string } | { ok: false; error: DictError }

export const isOpenLookupMessage = (message: unknown): message is OpenLookupMessage =>
  (message as OpenLookupMessage | undefined)?.type === "lookup:open"

export const isLookupRequestMessage = (message: unknown): message is LookupRequestMessage =>
  (message as LookupRequestMessage | undefined)?.type === "lookup:request" &&
  typeof (message as LookupRequestMessage).word === "string" &&
  isLookupContext((message as LookupRequestMessage).context)

export const isShownLookupMessage = (message: unknown): message is ShownLookupMessage =>
  (message as ShownLookupMessage | undefined)?.type === "lookup:shown" &&
  typeof (message as ShownLookupMessage).word === "string" &&
  typeof (message as ShownLookupMessage).lang === "string"

const isLookupContext = (value: unknown): value is LookupContext | undefined =>
  value === undefined ||
  (typeof (value as LookupContext).text === "string" &&
    ["number", "undefined"].includes(typeof (value as LookupContext).at))

const sendLookupRequest = ResultAsync.fromThrowable(
  (word: string, hints: LookupHints, context: LookupContext | undefined): Promise<LookupReply | undefined> =>
    browser.runtime.sendMessage({
      type: "lookup:request",
      word,
      hints,
      context,
    } satisfies LookupRequestMessage),
  fromUnknown,
)

/** Ask the background script for `word`. Always resolves. */
export const requestLookup = (
  word: string,
  hints: LookupHints,
  context: LookupContext | undefined,
): Promise<LookupReply> =>
  sendLookupRequest(word, hints, context).match(
    (reply): LookupReply =>
      reply ?? {
        ok: false,
        languages: [],
        paused: [],
        tried: [],
        error: fromUnknown("The background script did not reply"),
      },
    (error): LookupReply => ({ ok: false, languages: [], paused: [], tried: [], error }),
  )

/**
 * The language a report on `reply` goes to: the one that answered, or on a miss the one ranked first.
 * Unset when the lookup failed.
 */
export const reportLanguage = (reply: LookupReply): string | undefined =>
  reply.ok ? (reply.lang ?? reply.tried[0]) : undefined

/** Tell the background which answer the popover shows. Sends nothing when the lookup failed. */
export const sendShownLookup = (word: string, reply: LookupReply): void => {
  const lang = reportLanguage(reply)
  if (lang === undefined) {
    return
  }
  browser.runtime
    .sendMessage({ type: "lookup:shown", word, lang } satisfies ShownLookupMessage)
    .catch((error: unknown) => console.warn("Could not keep the shown lookup", error))
}

export const isAudioRequestMessage = (message: unknown): message is AudioRequestMessage =>
  (message as AudioRequestMessage | undefined)?.type === "audio:request" &&
  typeof (message as AudioRequestMessage).url === "string"

const sendAudioRequest = ResultAsync.fromThrowable(
  (url: string): Promise<AudioReply | undefined> =>
    browser.runtime.sendMessage({ type: "audio:request", url } satisfies AudioRequestMessage),
  fromUnknown,
)

/** Ask the background script for the recording at `url`. */
export const requestAudio = (url: string): ResultAsync<ArrayBuffer, DictError> =>
  sendAudioRequest(url).andThen((reply) =>
    reply === undefined
      ? err(fromUnknown("The background script did not reply"))
      : reply.ok
        ? ok(Uint8Array.from(atob(reply.data), (char) => char.charCodeAt(0)).buffer)
        : err(reply.error),
  )

/** Content to background: which of `lemmas` Anki already has a card for. */
export type InAnkiMessage = { type: "anki:in-anki"; lemmas: Array<string> }

export const isInAnkiMessage = (message: unknown): message is InAnkiMessage =>
  (message as InAnkiMessage | undefined)?.type === "anki:in-anki" &&
  Array.isArray((message as InAnkiMessage).lemmas) &&
  (message as InAnkiMessage).lemmas.every((lemma) => typeof lemma === "string")

/** Ask the background which of `lemmas` are in Anki. None when Anki cannot be asked, as a warning there is only a hint. */
export const askInAnki = (lemmas: Array<string>): Promise<Array<string>> =>
  browser.runtime
    .sendMessage({ type: "anki:in-anki", lemmas } satisfies InAnkiMessage)
    .then((found: unknown) =>
      Array.isArray(found) ? found.filter((lemma): lemma is string => typeof lemma === "string") : [],
    )
    .catch(() => [])
