/** Reading a subtitle file into cues. */
import { err, ok, ResultAsync, type Result } from "neverthrow"
import { toError } from "$lib/errors"
import { inOrder, type Cue } from "$lib/subtitles/cues"
import { readAss } from "./ass"
import { readTimed } from "./timed"

export type SubtitleFileError =
  { kind: "unsupported"; extension: string } | { kind: "unreadable"; cause: Error } | { kind: "empty" }

/** Extensions of the subtitle files the player reads. */
export const SUBTITLE_EXTENSIONS = ["srt", "vtt", "ass", "ssa"]

/** The extension of `name`, lowercased, without the dot. */
export const extensionOf = (name: string): string => /\.([^.]+)$/u.exec(name)?.[1]?.toLowerCase() ?? ""

/** Whether `name` looks like a subtitle file. */
export const isSubtitleFile = (name: string): boolean => SUBTITLE_EXTENSIONS.includes(extensionOf(name))

/** A file's text. A byte order mark says UTF-16. Anything else is read as UTF-8. */
export const decodeText = (bytes: ArrayBuffer): string => {
  const view = new Uint8Array(bytes)
  const encoding =
    view[0] === 0xff && view[1] === 0xfe
      ? "utf-16le"
      : view[0] === 0xfe && view[1] === 0xff
        ? "utf-16be"
        : "utf-8"
  return new TextDecoder(encoding).decode(view)
}

/** The cues of a subtitle file's `text`, in the order they show. */
export const cuesOf = (name: string, text: string): Result<Array<Cue>, SubtitleFileError> => {
  const extension = extensionOf(name)
  if (!SUBTITLE_EXTENSIONS.includes(extension)) {
    return err({ kind: "unsupported", extension })
  }
  const cues = inOrder(extension === "ass" || extension === "ssa" ? readAss(text) : readTimed(text))
  return cues.length === 0 ? err({ kind: "empty" }) : ok(cues)
}

/** The cues of a subtitle `file`, in the order they show. */
export const readSubtitleFile = (file: File): ResultAsync<Array<Cue>, SubtitleFileError> =>
  ResultAsync.fromPromise(file.arrayBuffer(), (cause): SubtitleFileError => ({
    kind: "unreadable",
    cause: toError(cause),
  })).andThen((bytes) => cuesOf(file.name, decodeText(bytes)))
