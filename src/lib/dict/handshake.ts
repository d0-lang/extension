import { ResultAsync, err, ok, safeTry } from "neverthrow"
import { getStoredServer } from "../storage"
import { getKey, getMeta } from "./api"
import { fromUnknown, handshakeError, type DictError } from "./errors"
import type { ServerMeta } from "./types"
import { normalizeServerUrl } from "./url"

/**
 * `url` is where meta was fetched; bind this, not necessarily the URL the user typed.
 * `movedFrom` is the normalized URL asked for, set only when `new_source` led elsewhere.
 */
export type HandshakeOk = {
  url: string
  key: string
  meta: ServerMeta
  movedFrom: string | undefined
}

/**
 * Fetches signed metadata, verified with the stored key when `baseUrl` is bound, else with the one `/v1/get-key` serves.
 *
 * A signature the stored key does not verify makes it ask for the key again: a different one is `kind: "identity"`,
 * the same one or none is `kind: "broken"`. Pass `newKey` after the user accepts a new key. It is then the only key
 * tried, and a failed signature is `kind: "broken"`.
 * Domain move is not an identity change: `getMeta` follows `new_source` with this same key.
 */
export const handshake = (
  baseUrl: string,
  newKey: string | undefined = undefined,
): ResultAsync<HandshakeOk, DictError> =>
  safeTry(async function* () {
    const requested = yield* normalizeServerUrl(baseUrl)
    const stored = yield* ResultAsync.fromPromise(getStoredServer(requested), fromUnknown)
    const key = newKey ?? stored?.key ?? (yield* getKey(requested))
    const fetched = await getMeta(requested, key)
    if (fetched.isErr()) {
      const { kind } = fetched.error
      if (kind !== "signature" && kind !== "missing-signature") {
        return err(fetched.error)
      }
      // Only the stored key can be out of date. One just fetched or accepted is the server's own.
      if (newKey === undefined && stored !== undefined) {
        const served = await getKey(requested)
        if (served.isOk() && served.value !== stored.key) {
          return err(handshakeError("identity", stored.verificationUrls, served.value))
        }
      }
      return err(handshakeError("broken", stored?.verificationUrls ?? []))
    }
    const { url, meta } = fetched.value
    return ok({
      url,
      key,
      meta,
      movedFrom: url === requested ? undefined : requested,
    })
  })
