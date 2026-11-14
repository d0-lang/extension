/** Fetches recordings for the popover, so the audio host learns nothing about the page the user is on. */
import { ResultAsync, errAsync, okAsync } from "neverthrow"
import { isAllowedAudioUrl } from "$lib/dict/entries"
import { audioHostError, bodyError, fromUnknown, httpError, type DictError } from "$lib/dict/errors"
import type { AudioReply } from "$lib/messages"
import { getServers } from "$lib/storage"

const AUDIO_TIMEOUT_MS = 10_000

/** Far above a spoken word, so a host cannot make the background hold a large file. */
const MAX_AUDIO_BYTES = 5_000_000

/** `String.fromCharCode` takes its characters as arguments, which a whole file would overflow. */
const BASE64_CHUNK = 0x8000

const toBase64 = (bytes: Uint8Array): string => {
  let binary = ""
  for (let start = 0; start < bytes.length; start += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(start, start + BASE64_CHUNK))
  }
  return btoa(binary)
}

/** Any bound server's host, not only the one that answered, which the popover checks already. */
const isAllowed = (url: string): ResultAsync<boolean, DictError> =>
  ResultAsync.fromPromise(getServers(), fromUnknown).map(
    (servers) =>
      isAllowedAudioUrl(url, undefined) ||
      Object.keys(servers).some((server) => isAllowedAudioUrl(url, server)),
  )

// The background's own request has no page to refer from. Redirects are refused, because they could leave the allowed hosts.
const request = ResultAsync.fromThrowable(
  (url: string) =>
    fetch(url, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
      signal: AbortSignal.timeout(AUDIO_TIMEOUT_MS),
    }),
  fromUnknown,
)

const readBytes = (response: Response): ResultAsync<Uint8Array, DictError> =>
  Number(response.headers.get("content-length")) > MAX_AUDIO_BYTES
    ? errAsync(bodyError("audio"))
    : ResultAsync.fromPromise(response.arrayBuffer(), fromUnknown).andThen((buffer) =>
        buffer.byteLength > MAX_AUDIO_BYTES ? errAsync(bodyError("audio")) : okAsync(new Uint8Array(buffer)),
      )

/** The recording at `url`, only from the hosts the protocol allows audio from. */
export const fetchAudio = (url: string): Promise<AudioReply> =>
  isAllowed(url)
    .andThen((allowed) => (allowed ? request(url) : errAsync(audioHostError())))
    .andThen((response) =>
      response.ok ? readBytes(response) : errAsync(httpError("audio", response.status)),
    )
    .match(
      (bytes): AudioReply => ({ ok: true, data: toBase64(bytes) }),
      (error): AudioReply => ({ ok: false, error }),
    )
