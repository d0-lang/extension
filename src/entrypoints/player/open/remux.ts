/** Rewrapping a Matroska video as MP4 without encoding it again, which Firefox plays far more smoothly. */
import { errAsync, okAsync, ResultAsync } from "neverthrow"
import type { StreamTargetChunk } from "mediabunny"
import { toError } from "$lib/errors"
import { extensionOf } from "../formats/read"

export type RemuxError = { kind: "uncopyable" } | { kind: "canceled" } | { kind: "failed"; cause: Error }

/** Written bytes kept as arrays before they go into a Blob, which the browser may keep out of the page's memory. */
const BLOB_PART_BYTES = 64 * 2 ** 20

/** Whether `file` plays better rewrapped as MP4 here. Firefox stutters on Matroska that it plays smoothly as MP4. */
export const needsRemux = (file: File): boolean => import.meta.env.FIREFOX && extensionOf(file.name) === "mkv"

const remux = async (
  file: File,
  onProgress: (share: number) => void,
  signal: AbortSignal | undefined,
): Promise<Blob | RemuxError> => {
  // Loaded only for a file that needs it, since it is most of the player's code.
  const { BlobSource, Conversion, Input, MATROSKA, Mp4OutputFormat, Output, StreamTarget } =
    await import("mediabunny")
  const parts: Array<Blob> = []
  let pending: Array<Uint8Array<ArrayBuffer>> = []
  let pendingBytes = 0
  let written = 0
  const flush = () => {
    parts.push(new Blob(pending))
    pending = []
    pendingBytes = 0
  }
  const writable = new WritableStream<StreamTargetChunk>({
    write: ({ data, position }) => {
      // Fragmented MP4 only appends, so the chunks in order are the file.
      if (position !== written) {
        throw new Error(`MP4 written out of order, at ${position} after ${written} bytes`)
      }
      written += data.byteLength
      pending.push(data)
      pendingBytes += data.byteLength
      if (pendingBytes >= BLOB_PART_BYTES) {
        flush()
      }
    },
  })
  const conversion = await Conversion.init({
    input: new Input({ formats: [MATROSKA], source: new BlobSource(file) }),
    output: new Output({
      format: new Mp4OutputFormat({ fastStart: "fragmented" }),
      target: new StreamTarget(writable, { chunked: true }),
    }),
    // Encoding again would be slow and lose quality. A shift would move the video away from its subtitles.
    copy: { mode: "forced" },
  })
  if (!conversion.isValid) {
    return { kind: "uncopyable" }
  }
  conversion.onProgress = onProgress
  const cancel = () => void conversion.cancel()
  signal?.addEventListener("abort", cancel, { once: true })
  try {
    await conversion.execute()
  } finally {
    signal?.removeEventListener("abort", cancel)
  }
  if (signal?.aborted === true) {
    return { kind: "canceled" }
  }
  flush()
  return new Blob(parts, { type: "video/mp4" })
}

/**
 * `file` rewrapped as MP4, its video and audio copied as they are. `onProgress` gets the share done, from 0 to 1.
 * Aborting `signal` stops it.
 */
export const remuxToMp4 = (
  file: File,
  onProgress: (share: number) => void,
  signal?: AbortSignal,
): ResultAsync<Blob, RemuxError> =>
  ResultAsync.fromPromise(remux(file, onProgress, signal), (cause): RemuxError =>
    signal?.aborted === true ? { kind: "canceled" } : { kind: "failed", cause: toError(cause) },
  ).andThen((result) => (result instanceof Blob ? okAsync(result) : errAsync(result)))
