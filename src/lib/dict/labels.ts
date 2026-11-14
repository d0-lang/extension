/** Keeps each server's label explanations up to date, for the pairs the user has in use on it. */
import { ResultAsync, ok, safeTry } from "neverthrow"
import { getServerByLang, getServers, setServerLabels } from "../storage"
import { getLabels } from "./api"
import { fromUnknown, type DictError } from "./errors"

/**
 * Fetch `url`'s explanations again and keep them. A failed or malformed fetch keeps the last copy.
 * A server that does not list the `labels` feature, or has no pair in use, keeps none.
 */
export const refreshLabels = (url: string): ResultAsync<void, DictError> =>
  safeTry(async function* () {
    const [servers, serverByLang] = yield* ResultAsync.fromPromise(
      Promise.all([getServers(), getServerByLang()]),
      fromUnknown,
    )
    const server = servers[url]
    const pairs = Object.entries(serverByLang)
      .filter(([lang, mapped]) => mapped === url && server?.languages.includes(lang) === true)
      .map(([lang]) => lang)
    if (server?.features?.includes("labels") !== true || pairs.length === 0) {
      yield* ResultAsync.fromPromise(setServerLabels(url, undefined), fromUnknown)
      return ok(undefined)
    }
    const labels = yield* getLabels(url, pairs)
    yield* ResultAsync.fromPromise(setServerLabels(url, labels), fromUnknown)
    return ok(undefined)
  })
