/** Messages between the background script and the content script's popover. */
import { ResultAsync } from "neverthrow"
import { fromUnknown, type DictError } from "./dict/errors"
import type { LookupOutcome } from "./dict/lookup"
import type { LookupHints } from "./dict/rank"

/** Background to content: the context menu item was pressed in this frame. */
export type OpenLookupMessage = { type: "lookup:open"; selectionText: string | undefined }

/** Content to background: fetch this word. */
export type LookupRequestMessage = { type: "lookup:request"; word: string; hints: LookupHints }

/** Plain data, because a `Result` does not survive messaging. `languages` are the bound ones. */
export type LookupReply = { languages: Array<string> } & (
  | ({ ok: true } & LookupOutcome)
  | { ok: false; error: DictError }
)

export const isOpenLookupMessage = (message: unknown): message is OpenLookupMessage =>
  (message as OpenLookupMessage | undefined)?.type === "lookup:open"

export const isLookupRequestMessage = (message: unknown): message is LookupRequestMessage =>
  (message as LookupRequestMessage | undefined)?.type === "lookup:request" &&
  typeof (message as LookupRequestMessage).word === "string"

const sendLookupRequest = ResultAsync.fromThrowable(
  (word: string, hints: LookupHints): Promise<LookupReply | undefined> =>
    browser.runtime.sendMessage({ type: "lookup:request", word, hints } satisfies LookupRequestMessage),
  fromUnknown,
)

/** Ask the background script for `word`. Always resolves. */
export const requestLookup = (word: string, hints: LookupHints): Promise<LookupReply> =>
  sendLookupRequest(word, hints).match(
    (reply): LookupReply =>
      reply ?? { ok: false, languages: [], error: fromUnknown("The background script did not reply") },
    (error): LookupReply => ({ ok: false, languages: [], error }),
  )
