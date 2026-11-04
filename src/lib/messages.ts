/** Messages between the background script and the content script's popover. */
import { ResultAsync } from "neverthrow"
import { fromUnknown, type DictError } from "./dict/errors"
import type { LookupOutcome } from "./dict/lookup"
import type { LookupHints } from "./dict/rank"

/** Background to content: the context menu item was pressed in this frame. */
export type OpenLookupMessage = { type: "lookup:open"; selectionText: string | undefined }

/** Content to background: fetch this word. `context` is set only where the user allows sending the sentence. */
export type LookupRequestMessage = {
  type: "lookup:request"
  word: string
  hints: LookupHints
  context: string | undefined
}

/**
 * Plain data, because a `Result` does not survive messaging. `languages` are the bound ones.
 * `tried` are the languages asked, in order, whether or not one answered.
 */
export type LookupReply = { languages: Array<string>; tried: Array<string> } & (
  | ({ ok: true } & LookupOutcome)
  | { ok: false; error: DictError }
)

export const isOpenLookupMessage = (message: unknown): message is OpenLookupMessage =>
  (message as OpenLookupMessage | undefined)?.type === "lookup:open"

export const isLookupRequestMessage = (message: unknown): message is LookupRequestMessage =>
  (message as LookupRequestMessage | undefined)?.type === "lookup:request" &&
  typeof (message as LookupRequestMessage).word === "string" &&
  ["string", "undefined"].includes(typeof (message as LookupRequestMessage).context)

const sendLookupRequest = ResultAsync.fromThrowable(
  (word: string, hints: LookupHints, context: string | undefined): Promise<LookupReply | undefined> =>
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
  context: string | undefined,
): Promise<LookupReply> =>
  sendLookupRequest(word, hints, context).match(
    (reply): LookupReply =>
      reply ?? {
        ok: false,
        languages: [],
        tried: [],
        error: fromUnknown("The background script did not reply"),
      },
    (error): LookupReply => ({ ok: false, languages: [], tried: [], error }),
  )
