/** Server check: the protocol fetches metadata again whenever the client starts, and at least once a day while it runs. */
import { ResultAsync, ok, safeTry } from "neverthrow"
import { acceptedLegal, handshake, legalChanged } from "$lib/dict"
import { toError } from "$lib/errors"
import {
  bindServer,
  getServerByLang,
  getServers,
  setServerIssue,
  type BoundServer,
  type ServerIssue,
} from "$lib/storage"

const DAILY_ALARM = "check-servers"
const DAY_MINUTES = 24 * 60

/**
 * Has the browser wake the background once a day, since it does not stay alive for a timer.
 * An alarm already set is left alone, because setting it again would start its day over.
 */
export const scheduleDailyCheck = async (): Promise<void> => {
  if ((await browser.alarms.get(DAILY_ALARM)) === undefined) {
    await browser.alarms.create(DAILY_ALARM, { periodInMinutes: DAY_MINUTES })
  }
}

export const isDailyCheck = (alarm: { name: string }): boolean => alarm.name === DAILY_ALARM

/** `name` and `url` are the ones now stored. `failed` changes nothing, since a server can be down for a moment. */
export type CheckResult = { name: string; url: string } & (
  { kind: "ok" | "failed" } | { kind: "moved"; movedFrom: string } | { kind: ServerIssue["kind"] }
)

const checkServer = (server: BoundServer, mapped: Array<string>): ResultAsync<CheckResult, Error> =>
  safeTry(async function* () {
    const result = await handshake(server.url)
    if (result.isErr()) {
      const { kind } = result.error
      if (kind !== "identity" && kind !== "broken") {
        return ok<CheckResult>({ kind: "failed", name: server.name, url: server.url })
      }
      yield* setServerIssue(server.url, { kind })
      return ok<CheckResult>({ kind, name: server.name, url: server.url })
    }
    const { url, key, meta, movedFrom } = result.value
    const changed = legalChanged(server.legal, meta.legal)
    // Languages the server stopped listing stay mapped, so they come back if it lists them again.
    // Changed policies stay unaccepted until the user reviews them.
    yield* bindServer(
      {
        url,
        key,
        name: meta.name,
        languages: meta.languages,
        verificationUrls: meta.verification_urls,
        features: meta.features,
        context: server.context,
        legal: changed ? server.legal : acceptedLegal(meta.legal),
      },
      mapped,
      movedFrom,
    )
    if (changed) {
      yield* setServerIssue(url, { kind: "legal" })
      return ok<CheckResult>({ kind: "legal", name: meta.name, url })
    }
    return ok<CheckResult>(
      movedFrom === undefined
        ? { kind: "ok", name: meta.name, url }
        : { kind: "moved", name: meta.name, url, movedFrom },
    )
  })

/**
 * Handshake with every bound server, one at a time so their storage writes do not race.
 * New metadata and a verified move are saved. A changed key, a failed signature or changed policies are stored as an issue.
 * `pending` and `results` are used for recursion only.
 */
export const checkServers = (
  pending: Array<BoundServer> | undefined = undefined,
  results: Array<CheckResult> = [],
): ResultAsync<Array<CheckResult>, Error> =>
  safeTry(async function* () {
    const [server, ...rest] = pending ?? Object.values(yield* ResultAsync.fromPromise(getServers(), toError))
    if (server === undefined) {
      return ok(results)
    }
    // Read again for each server, because an earlier move may have remapped languages.
    const serverByLang = yield* ResultAsync.fromPromise(getServerByLang(), toError)
    const mapped = Object.entries(serverByLang)
      .filter(([, url]) => url === server.url)
      .map(([lang]) => lang)
    const result = yield* checkServer(server, mapped)
    return ok(yield* checkServers(rest, [...results, result]))
  })
