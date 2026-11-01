import {
  ResultAsync,
  err,
  errAsync,
  fromThrowable,
  ok,
  safeTry,
} from "neverthrow";
import { verifyEd25519 } from "./crypto";
import {
  bodyError,
  fromUnknown,
  httpError,
  missingSignatureError,
  nonceError,
  signatureError,
  type DictError,
} from "./errors";
import {
  lookupResultSchema,
  newSourceSchema,
  parseBody,
  publicKeySchema,
  serverMetaSchema,
  type LookupResult,
  type ServerMeta,
} from "./schemas";
import { isDowngrade, normalizeServerUrl } from "./url";

/** Covers reading the body too, because the signal stays attached to the response. */
const REQUEST_TIMEOUT_MS = 10_000;

const request = ResultAsync.fromThrowable(
  (url: string, init?: RequestInit) =>
    fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }),
  fromUnknown,
);

const readJson = (response: Response): ResultAsync<unknown, DictError> =>
  ResultAsync.fromPromise(response.json(), fromUnknown);

const parseJsonBytes = fromThrowable(
  (bytes: Uint8Array): unknown =>
    JSON.parse(new TextDecoder().decode(bytes)) as unknown,
  (): DictError => bodyError("get-meta"),
);

/** Unsigned `/v1/get-key`. The client pins this key and verifies later meta with it. */
export const getKey = (baseUrl: string): ResultAsync<string, DictError> =>
  request(`${baseUrl}/v1/get-key`).andThen((response) => {
    if (!response.ok) {
      return errAsync(httpError("get-key", response.status));
    }
    return readJson(response).andThen((body) =>
      parseBody(publicKeySchema, body, "get-key").map(({ key }) => key),
    );
  });

export type GetMetaOk = { url: string; meta: ServerMeta };

/** Number of possible new_source redirects */
const MAX_SOURCE_HOPS = 5;

/**
 * Get `/v1/get-meta` signed with `publicKey`.
 *
 * The body is verified as raw bytes (`X-Signature` + `X-Nonce` echo). A valid
 * new_source redirect is followed with the same public key, but never from https
 * to http. `seen` is the followed trail, used for recursion only.
 *
 * @returns the metadata and the URL it came from (the last hop, not `baseUrl`)
 */
export const getMeta = (
  url: string,
  publicKey: string,
  seen: ReadonlyArray<string> = [],
): ResultAsync<GetMetaOk, DictError> =>
  safeTry(async function* () {
    if (seen.includes(url) || seen.length >= MAX_SOURCE_HOPS) {
      return err(bodyError("get-meta"));
    }

    const nonce = crypto.randomUUID();
    const response = yield* request(`${url}/v1/get-meta`, {
      headers: { "X-Nonce": nonce },
    });
    if (!response.ok) {
      return err(httpError("get-meta", response.status));
    }

    const bytes = new Uint8Array(
      yield* ResultAsync.fromPromise(response.arrayBuffer(), fromUnknown),
    );
    const signature = response.headers.get("x-signature");
    if (signature === null || signature.length === 0) {
      return err(missingSignatureError());
    }
    // Verify the exact body bytes against the safed public key, then parse.
    const isValid = yield* ResultAsync.fromPromise(
      verifyEd25519(publicKey, bytes, signature),
      fromUnknown,
    );
    if (!isValid) {
      return err(signatureError());
    }

    const json = yield* parseJsonBytes(bytes);
    const moved = newSourceSchema.safeParse(json);
    if (moved.success) {
      if (moved.data.nonce !== nonce) {
        return err(nonceError());
      }
      const next = yield* normalizeServerUrl(moved.data.new_source).mapErr(() =>
        bodyError("get-meta"),
      );
      if (isDowngrade(url, next)) {
        return err(bodyError("get-meta"));
      }
      return ok(yield* getMeta(next, publicKey, [...seen, url]));
    }

    const meta = yield* parseBody(serverMetaSchema, json, "get-meta");
    if (meta.nonce !== nonce) {
      return err(nonceError());
    }
    return ok({ url, meta });
  });

// TODO: `/v1/lookup`.
export const lookup = (
  baseUrl: string,
  word: string,
  lang: string,
): ResultAsync<LookupResult, DictError> => {
  const payload = encodeURIComponent(JSON.stringify({ word, lang }));
  return request(`${baseUrl}/v1/lookup?payload=${payload}`).andThen(
    (response) => {
      if (!response.ok) {
        return errAsync(httpError("lookup", response.status));
      }
      return readJson(response).andThen((body) =>
        parseBody(lookupResultSchema, body, "lookup"),
      );
    },
  );
};
