import {
  ResultAsync,
  err,
  errAsync,
  fromThrowable,
  ok,
  safeTry,
  type Result,
} from "neverthrow";
import { verifyEd25519 } from "./crypto";
import { isValidSplit } from "./entries";
import {
  badRequestError,
  bodyError,
  fromUnknown,
  httpError,
  missingSignatureError,
  nonceError,
  signatureError,
  unsupportedLangError,
  type DictError,
} from "./errors";
import {
  lookupErrorSchema,
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
  (url: string, init?: RequestInit, timeoutMs: number = REQUEST_TIMEOUT_MS) =>
    fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }),
  fromUnknown,
);

const readJson = (response: Response): ResultAsync<unknown, DictError> =>
  ResultAsync.fromPromise(response.json(), fromUnknown);

const parseJson = (text: string, label: string): Result<unknown, DictError> =>
  fromThrowable(
    (): unknown => JSON.parse(text) as unknown,
    () => bodyError(label),
  )();

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

    const json = yield* parseJson(new TextDecoder().decode(bytes), "get-meta");
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

/**
 * Get `/v1/lookup`. A word the server does not know is `ok` with no entries.
 * `context` is the sentence around `word`; pass it only to servers that list the `context` feature.
 * Segments that do not split `word` per the protocol are dropped.
 */
export const lookup = (
  baseUrl: string,
  word: string,
  lang: string,
  context: string | undefined,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): ResultAsync<LookupResult, DictError> =>
  safeTry(async function* () {
    // A `+` in the word is already `%2B` here, so every remaining `+` is a space.
    const query = new URLSearchParams({
      word,
      lang,
      ...(context === undefined ? {} : { context }),
    })
      .toString()
      .replaceAll("+", "%20");
    const response = yield* request(
      `${baseUrl}/v1/lookup?${query}`,
      undefined,
      timeoutMs,
    );
    const text = yield* ResultAsync.fromPromise(response.text(), fromUnknown);

    if (!response.ok) {
      const rejection = lookupErrorSchema.safeParse(
        parseJson(text, "lookup").unwrapOr(undefined),
      );
      if (response.status !== 400 || !rejection.success) {
        return err(httpError("lookup", response.status));
      }
      return err(
        rejection.data.error === "bad_request"
          ? badRequestError()
          : unsupportedLangError(),
      );
    }

    const { entries, segments } = yield* parseBody(
      lookupResultSchema,
      yield* parseJson(text, "lookup"),
      "lookup",
    );
    return ok(
      segments !== undefined && isValidSplit(segments, word, entries.length)
        ? { entries, segments }
        : { entries },
    );
  });
