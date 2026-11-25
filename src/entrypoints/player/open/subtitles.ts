/** A subtitle file made ready to show. */
import { ResultAsync } from "neverthrow"
import { isFast } from "$lib/subtitles/cues"
import type { Track } from "$lib/subtitles/controller"
import { readSubtitleFile, type SubtitleFileError } from "../formats/read"
import { languageOf } from "./language"

/** A track and the file it came from. */
export type FileTrack = Track & { name: string }

/** The cues of `file`, its language, and how fast they go. */
export const loadSubtitles = (file: File): ResultAsync<FileTrack, SubtitleFileError> =>
  readSubtitleFile(file).andThen((cues) =>
    ResultAsync.fromSafePromise(languageOf(file.name, cues)).map((lang) => ({
      name: file.name,
      lang,
      cues,
      fast: isFast(cues),
    })),
  )

/** What to tell the viewer when `name` could not be used. */
export const problemOf = (name: string, error: SubtitleFileError): string => {
  switch (error.kind) {
    case "unsupported":
      return `${name}: .${error.extension} subtitles cannot be read. Use an SRT, WebVTT or ASS file.`
    case "unreadable":
      return `${name} could not be read.`
    case "empty":
      return `${name} has no subtitles in it.`
  }
}
