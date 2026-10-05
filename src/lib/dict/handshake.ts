/** Handshake protocol: load any stored bind, get the live key, then signed meta.
 *  Omit `newKey` for a normal connect (identity mismatch → `kind: "identity"`).
 *  Pass `newKey` after the user accepts a rotation; signature failure becomes `kind: "broken"`. */
import { ResultAsync, err, ok, safeTry } from "neverthrow";
import { getStoredServer } from "../storage";
import { getKey, getMeta } from "./api";
import { fromUnknown, handshakeError, type DictError } from "./errors";
import type { ServerMeta } from "./types";

export type HandshakeOk = { key: string; meta: ServerMeta };

export const handshake = (
  baseUrl: string,
  newKey: string | undefined = undefined,
): ResultAsync<HandshakeOk, DictError> =>
  safeTry(async function* () {
    const stored = yield* ResultAsync.fromPromise(
      getStoredServer(baseUrl),
      fromUnknown,
    );
    const key = newKey ?? (yield* getKey(baseUrl));
    if (newKey === undefined && stored !== undefined && stored.key !== key) {
      return err(handshakeError("identity", stored.verificationUrls, key));
    }
    const meta = yield* getMeta(baseUrl, key).mapErr((cause) =>
      cause.kind === "signature"
        ? handshakeError("broken", stored?.verificationUrls ?? [])
        : cause,
    );
    return ok({ key, meta });
  });
