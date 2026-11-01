import { ResultAsync, err, ok, safeTry } from "neverthrow"
import { getServerByLang, getServers } from "../storage"
import { lookup } from "./api"
import { fromUnknown, noServerError, type DictError } from "./errors"
import { rankLanguages, type LookupHints } from "./rank"
import type { LookupEntry } from "./schemas"

/** A dead server must not hold up the languages after it. */
const FALLBACK_TIMEOUT_MS = 2_000

type Target = { lang: string; url: string }

/** `lang` is the language that returned `entries`, unset when none did. */
export type LookupOutcome = { lang: string | undefined; entries: Array<LookupEntry> }

// A language whose server stopped listing it cannot answer.
const loadTargets = (): ResultAsync<Array<Target>, DictError> =>
  ResultAsync.fromPromise(Promise.all([getServers(), getServerByLang()]), fromUnknown).map(
    ([servers, serverByLang]) =>
      Object.entries(serverByLang)
        .filter(([lang, url]) => servers[url]?.languages.includes(lang))
        .map(([lang, url]) => ({ lang, url })),
  )

/**
 * First target with entries. A failure only surfaces if no target answered at all.
 * `firstFailure` and `sawMiss` are used for recursion only.
 */
const tryTargets = (
  word: string,
  targets: ReadonlyArray<Target>,
  firstFailure: DictError | undefined = undefined,
  sawMiss: boolean = false,
): ResultAsync<LookupOutcome, DictError> =>
  safeTry(async function* () {
    const [target, ...rest] = targets
    if (target === undefined) {
      return firstFailure !== undefined && !sawMiss
        ? err(firstFailure)
        : ok({ lang: undefined, entries: [] })
    }
    const result = await lookup(
      target.url,
      word,
      target.lang,
      ...(rest.length > 0 ? [FALLBACK_TIMEOUT_MS] : []),
    )
    if (result.isOk() && result.value.entries.length > 0) {
      return ok({ lang: target.lang, entries: result.value.entries })
    }
    return ok(
      yield* result.isOk()
        ? tryTargets(word, rest, firstFailure, true)
        : tryTargets(word, rest, firstFailure ?? result.error, sawMiss),
    )
  })

export const boundLanguages = (): ResultAsync<Array<string>, DictError> =>
  loadTargets().map((targets) => targets.map(({ lang }) => lang))

/** Look `word` up in the bound languages `hints` rank first, stopping at the first hit. */
export const lookupWord = (
  word: string,
  hints: LookupHints,
): ResultAsync<LookupOutcome, DictError> =>
  safeTry(async function* () {
    const targets = yield* loadTargets()
    if (targets.length === 0) {
      return err(noServerError())
    }
    const ranked = rankLanguages(targets.map(({ lang }) => lang), hints)
    return ok(
      yield* tryTargets(
        word,
        ranked.flatMap((lang) => targets.filter((target) => target.lang === lang)),
      ),
    )
  })
