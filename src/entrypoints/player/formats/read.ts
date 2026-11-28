/** Reading a subtitle file into cues. */
import { err, ok, ResultAsync, type Result } from "neverthrow"
import { toError } from "$lib/errors"
import { inOrder, type Cue } from "$lib/subtitles/cues"
import { languageInName } from "../open/language"
import { readAss } from "./ass"
import { decodeSubtitles, type Detect } from "./encoding"
import { readTimed } from "$lib/subtitles/timed"

export type SubtitleFileError =
  { kind: "unsupported"; extension: string } | { kind: "unreadable"; cause: Error } | { kind: "empty" }

/** Extensions of the subtitle files the player reads. */
export const SUBTITLE_EXTENSIONS = ["srt", "vtt", "ass", "ssa"]

/** The extension of `name`, lowercased, without the dot. */
export const extensionOf = (name: string): string => /\.([^.]+)$/u.exec(name)?.[1]?.toLowerCase() ?? ""

/** Whether `name` looks like a subtitle file. */
export const isSubtitleFile = (name: string): boolean => SUBTITLE_EXTENSIONS.includes(extensionOf(name))

/** How much of a file's cues the language its encoding is told by is read from. */
const SAMPLE_CHARS = 2000

/** Some of the cues `text` holds as file `name`, without the file's own words, like an ASS file's headings. */
const sampleOf = (name: string, text: string): string =>
  cuesOf(name, text)
    .map((cues) =>
      cues
        .map((cue) => cue.text)
        .join("\n")
        .slice(0, SAMPLE_CHARS),
    )
    .unwrapOr("")

/** The languages `text` is in, by the browser's own detection, which keeps it on this device. */
const detectWithBrowser: Detect = (text) =>
  browser.i18n
    .detectLanguage(text)
    .then(({ languages }) => languages)
    .catch(() => [])

/** The cues of a subtitle file's `text`, in the order they show. */
export const cuesOf = (name: string, text: string): Result<Array<Cue>, SubtitleFileError> => {
  const extension = extensionOf(name)
  if (!SUBTITLE_EXTENSIONS.includes(extension)) {
    return err({ kind: "unsupported", extension })
  }
  const cues = inOrder(extension === "ass" || extension === "ssa" ? readAss(text) : readTimed(text))
  return cues.length === 0 ? err({ kind: "empty" }) : ok(cues)
}

/**
 * The cues of a subtitle `file`, in the order they show, in the encoding it was saved in. `detect` stands in for the
 * browser's language detection.
 */
export const readSubtitleFile = (
  file: File,
  detect: Detect = detectWithBrowser,
): ResultAsync<Array<Cue>, SubtitleFileError> =>
  ResultAsync.fromPromise(file.arrayBuffer(), (cause): SubtitleFileError => ({
    kind: "unreadable",
    cause: toError(cause),
  }))
    .andThen((bytes) =>
      ResultAsync.fromSafePromise(
        decodeSubtitles(bytes, languageInName(file.name), (text) => sampleOf(file.name, text), detect),
      ),
    )
    .andThen((text) => cuesOf(file.name, text))
