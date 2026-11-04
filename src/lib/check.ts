/** Server check on client start: the protocol fetches metadata again whenever the client starts. */
import { ResultAsync, ok, safeTry } from "neverthrow"
import { handshake } from "./dict"
import {
  bindServer,
  getServerByLang,
  getServers,
  setServerIssue,
  type BoundServer,
  type ServerIssue,
} from "./storage"

/** `name` and `url` are the ones now stored. `failed` changes nothing, since a server can be down for a moment. */
export type CheckResult = { name: string; url: string } & (
  | { kind: "ok" | "failed" }
  | { kind: "moved"; movedFrom: string }
  | { kind: ServerIssue["kind"] }
)

const fromUnknown = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause))

const checkServer = (
  server: BoundServer,
  mapped: Array<string>,
): ResultAsync<CheckResult, Error> =>
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
    // Languages the server stopped listing stay mapped, so they come back if it lists them again.
    yield* bindServer(
      {
        url,
        key,
        name: meta.name,
        languages: meta.languages,
        verificationUrls: meta.verification_urls,
        features: meta.features,
      },
      mapped,
      movedFrom,
    )
    return ok<CheckResult>(
      movedFrom === undefined
        ? { kind: "ok", name: meta.name, url }
        : { kind: "moved", name: meta.name, url, movedFrom },
    )
  })

/**
 * Handshake with every bound server, one at a time so their storage writes do not race.
 * New metadata and a verified move are saved. A changed key or a failed signature is stored as an issue.
 * `pending` and `results` are used for recursion only.
 */
export const checkServers = (
  pending: Array<BoundServer> | undefined = undefined,
  results: Array<CheckResult> = [],
): ResultAsync<Array<CheckResult>, Error> =>
  safeTry(async function* () {
    const [server, ...rest] =
      pending ?? Object.values(yield* ResultAsync.fromPromise(getServers(), fromUnknown))
    if (server === undefined) {
      return ok(results)
    }
    // Read again for each server, because an earlier move may have remapped languages.
    const serverByLang = yield* ResultAsync.fromPromise(getServerByLang(), fromUnknown)
    const mapped = Object.entries(serverByLang)
      .filter(([, url]) => url === server.url)
      .map(([lang]) => lang)
    const result = yield* checkServer(server, mapped)
    return ok(yield* checkServers(rest, [...results, result]))
  })
