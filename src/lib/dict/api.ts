/** Dictionary HTTP: `/v1/get-key`, signed `/v1/get-meta`, `/v1/lookup`.
 *  All return ResultAsync; `kind: "signature"` means the meta body did not verify. */
import {
  ResultAsync,
  err,
  errAsync,
  fromThrowable,
  ok,
  safeTry,
} from "neverthrow";
import { normalizeServerUrl } from "../storage";
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
  parseBody,
  publicKeySchema,
  serverMetaSchema,
  type LookupResult,
  type ServerMeta,
} from "./schemas";

const endpoint = (baseUrl: string, path: string): string =>
  `${normalizeServerUrl(baseUrl)}${path}`;

const request = ResultAsync.fromThrowable(fetch, fromUnknown);

const readJson = (response: Response): ResultAsync<unknown, DictError> =>
  ResultAsync.fromPromise(response.json(), fromUnknown);

const parseJsonBytes = fromThrowable(
  (bytes: Uint8Array): unknown =>
    JSON.parse(new TextDecoder().decode(bytes)) as unknown,
  (): DictError => bodyError("get-meta"),
);

export const getKey = (baseUrl: string): ResultAsync<string, DictError> =>
  request(endpoint(baseUrl, "/v1/get-key")).andThen((response) => {
    if (!response.ok) {
      return errAsync(httpError("get-key", response.status));
    }
    return readJson(response).andThen((body) =>
      parseBody(publicKeySchema, body, "get-key").map(({ key }) => key),
    );
  });

export const getMeta = (
  baseUrl: string,
  publicKey: string,
): ResultAsync<ServerMeta, DictError> =>
  safeTry<ServerMeta, DictError>(async function* () {
    const nonce = crypto.randomUUID();
    const response = yield* request(endpoint(baseUrl, "/v1/get-meta"), {
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
    const isValid = yield* ResultAsync.fromPromise(
      verifyEd25519(publicKey, bytes, signature),
      fromUnknown,
    );
    if (!isValid) {
      return err(signatureError());
    }

    const json = yield* parseJsonBytes(bytes);
    const meta = yield* parseBody(serverMetaSchema, json, "get-meta");
    if (meta.nonce !== nonce) {
      return err(nonceError());
    }
    return ok(meta);
  });

export const lookup = (
  baseUrl: string,
  word: string,
  lang: string,
): ResultAsync<LookupResult, DictError> => {
  const payload = encodeURIComponent(JSON.stringify({ word, lang }));
  return request(endpoint(baseUrl, `/v1/lookup?payload=${payload}`)).andThen(
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
