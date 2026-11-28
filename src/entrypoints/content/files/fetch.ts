/** Reading a file the page's player downloads, again from the extension. */
import { errAsync, ResultAsync } from "neverthrow"
import { toError } from "$lib/errors"

/** The text at `url`. */
export const fetchText = (url: string): ResultAsync<string, Error> =>
  ResultAsync.fromPromise(fetch(url), toError).andThen((response) =>
    response.ok
      ? ResultAsync.fromPromise(response.text(), toError)
      : errAsync(new Error(`HTTP ${response.status}`)),
  )

/** A subtitle file to read: a name that tells it from the others, and its text. */
export type SiteFile = { name: string; text: () => ResultAsync<string, Error> }
