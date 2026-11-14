import { ResultAsync, err, ok, safeTry } from "neverthrow"
import {
  contextSending,
  getServerByLang,
  getServerIssues,
  getServers,
  type ContextSending,
  type CreditSource,
} from "../storage"
import { lookup, type LookupContext } from "./api"
import { fromUnknown, noServerError, pausedError, type DictError } from "./errors"
import { rankLanguages, type LookupHints } from "./rank"
import type { LookupResult } from "./schemas"

/** A dead server must not hold up the languages after it. */
const FALLBACK_TIMEOUT_MS = 2_000

/** `context` is `none` when the server does not list the `context` feature. */
type Target = { lang: string; url: string; context: ContextSending; sources: Array<CreditSource> }

/**
 * `lang` is the language that returned `entries`, and `server` the URL that answered. Both unset when none did.
 * `sources` are the ones the answering server's stored metadata lists, which decide the links shown.
 */
export type LookupOutcome = {
  lang: string | undefined
  server: string | undefined
  sources: Array<CreditSource>
} & LookupResult

/** `paused` are bound languages whose server has an issue the user has not resolved. */
type Targets = { targets: Array<Target>; paused: Array<string> }

// A language whose server stopped listing it cannot answer.
const loadTargets = (): ResultAsync<Targets, DictError> =>
  ResultAsync.fromPromise(Promise.all([getServers(), getServerByLang(), getServerIssues()]), fromUnknown).map(
    ([servers, serverByLang, issues]) => {
      const offered = Object.entries(serverByLang).filter(([lang, url]) =>
        servers[url]?.languages.includes(lang),
      )
      const isPaused = (url: string) => issues[url] !== undefined
      return {
        targets: offered
          .filter(([, url]) => !isPaused(url))
          .map(([lang, url]) => ({
            lang,
            url,
            context:
              servers[url]?.features?.includes("context") === true ? contextSending(servers[url]) : "none",
            sources: servers[url]?.sources ?? [],
          })),
        paused: offered.filter(([, url]) => isPaused(url)).map(([lang]) => lang),
      }
    },
  )

const sendsContext = (sending: ContextSending, siteBlocked: boolean): boolean =>
  sending === "all" || (sending === "unblocked" && !siteBlocked)

/**
 * First target with entries. A failure only surfaces if no target answered at all.
 * `firstFailure` and `sawMiss` are used for recursion only.
 */
const tryTargets = (
  word: string,
  context: LookupContext | undefined,
  siteBlocked: boolean,
  targets: ReadonlyArray<Target>,
  firstFailure: DictError | undefined = undefined,
  sawMiss: boolean = false,
): ResultAsync<LookupOutcome, DictError> =>
  safeTry(async function* () {
    const [target, ...rest] = targets
    if (target === undefined) {
      return firstFailure !== undefined && !sawMiss
        ? err(firstFailure)
        : ok({ lang: undefined, server: undefined, sources: [], entries: [] })
    }
    const result = await lookup(
      target.url,
      word,
      target.lang,
      sendsContext(target.context, siteBlocked) ? context : undefined,
      ...(rest.length > 0 ? [FALLBACK_TIMEOUT_MS] : []),
    )
    if (result.isOk() && result.value.entries.length > 0) {
      return ok({ lang: target.lang, server: target.url, sources: target.sources, ...result.value })
    }
    return ok(
      yield* result.isOk()
        ? tryTargets(word, context, siteBlocked, rest, firstFailure, true)
        : tryTargets(word, context, siteBlocked, rest, firstFailure ?? result.error, sawMiss),
    )
  })

/** `languages` a lookup can ask now, and the `paused` ones it skips until the user resolves their server's issue. */
export const boundLanguages = (): ResultAsync<
  { languages: Array<string>; paused: Array<string> },
  DictError
> => loadTargets().map(({ targets, paused }) => ({ languages: targets.map(({ lang }) => lang), paused }))

/**
 * Look `word` up in the bound languages `hints` rank first, stopping at the first hit.
 * `context` only goes to servers that list the `context` feature and are set to take it from this site.
 * Servers with an issue are skipped until the user resolves it.
 */
export const lookupWord = (
  word: string,
  hints: LookupHints,
  context: LookupContext | undefined,
  siteBlocked: boolean,
): ResultAsync<LookupOutcome, DictError> =>
  safeTry(async function* () {
    const { targets, paused } = yield* loadTargets()
    if (targets.length === 0) {
      return err(paused.length > 0 ? pausedError() : noServerError())
    }
    const ranked = rankLanguages(
      targets.map(({ lang }) => lang),
      hints,
    )
    return ok(
      yield* tryTargets(
        word,
        context,
        siteBlocked,
        ranked.flatMap((lang) => targets.filter((target) => target.lang === lang)),
      ),
    )
  })
