import type { ResultAsync } from "neverthrow"
import * as z from "zod/mini"
import { invoke, type AnkiError, type AnkiTarget } from "./connect"
import { stressedHtml } from "./fields"
import { NOTE_TYPE } from "./note-type"

/** `text` inside a quoted Anki search, where these characters are wildcards or end the quote. */
const searchText = (text: string): string => text.replace(/[\\"*_]/g, (char) => `\\${char}`)

/** The search for DaDict notes whose `Word` is `lemma`, as a card writes it. Anki compares it ignoring case. */
export const wordSearch = (lemma: string): string =>
  `"note:${NOTE_TYPE}" "Word:${searchText(stressedHtml(lemma))}"`

/** Which of `lemmas` Anki already has a DaDict note for, in one request. */
export const lemmasInAnki = (
  target: AnkiTarget,
  lemmas: ReadonlyArray<string>,
): ResultAsync<Array<string>, AnkiError> =>
  invoke(target, "multi", z.array(z.unknown()), {
    actions: lemmas.map((lemma) => ({ action: "findNotes", params: { query: wordSearch(lemma) } })),
  }).map((found) =>
    lemmas.filter((_, index) => {
      // Each item is the action's own result, or an `{ result, error }` reply on newer versions of the add-on.
      const item = found[index]
      const ids = Array.isArray(item) ? item : (item as { result?: unknown } | undefined)?.result
      return Array.isArray(ids) && ids.length > 0
    }),
  )
