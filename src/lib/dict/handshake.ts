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
 * Load any stored bind, pin `/v1/get-key`, then signed meta.
 *
 * Omit `newKey` for a normal connect (advertised key ≠ stored pin → `kind: "identity"`).
 * Pass `newKey` after the user accepts a rotation; signature failure then is `kind: "broken"`.
 * Domain move is not an identity change: `getMeta` follows `new_source` with this same key.
 */
export const handshake = (
  baseUrl: string,
  newKey: string | undefined = undefined,
): ResultAsync<HandshakeOk, DictError> =>
  safeTry(async function* () {
    const requested = yield* normalizeServerUrl(baseUrl)
    const stored = yield* ResultAsync.fromPromise(getStoredServer(requested), fromUnknown)
    const key = newKey ?? (yield* getKey(requested))
    if (newKey === undefined && stored !== undefined && stored.key !== key) {
      return err(handshakeError("identity", stored.verificationUrls, key))
    }
    const { url, meta } = yield* getMeta(requested, key).mapErr((cause) =>
      cause.kind === "signature" || cause.kind === "missing-signature"
        ? handshakeError("broken", stored?.verificationUrls ?? [])
        : cause,
    )
    return ok({
      url,
      key,
      meta,
      movedFrom: url === requested ? undefined : requested,
    })
  })
