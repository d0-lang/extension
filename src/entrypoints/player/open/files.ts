/** Sorting the files the viewer gives the player into a video and its subtitles. */
import { extensionOf, isSubtitleFile } from "../formats/read"

/** Extensions of videos a browser may play, for files the system gives no type. */
const VIDEO_EXTENSIONS = ["mp4", "m4v", "webm", "mkv", "mov", "ogv"]

export type Files = { video: File | undefined; subtitles: Array<File> }

/** The first video among `files`, and every subtitle file. Anything else is left out. */
export const sortFiles = (files: Iterable<File>): Files => {
  const list = [...files]
  return {
    video: list.find(
      ({ name, type }) => type.startsWith("video/") || VIDEO_EXTENSIONS.includes(extensionOf(name)),
    ),
    subtitles: list.filter(({ name }) => isSubtitleFile(name)),
  }
}

/** `name` without its extension. */
export const stemOf = (name: string): string => name.replace(/\.[^.]+$/u, "")

/** `subtitles` with the ones named after `video` first, like `Film.en.srt` for `Film.mkv`. */
export const matchingFirst = (video: string, subtitles: ReadonlyArray<File>): Array<File> => {
  const stem = stemOf(video).toLowerCase()
  const matches = ({ name }: File) => name.toLowerCase().startsWith(`${stem}.`)
  return [...subtitles.filter(matches), ...subtitles.filter((file) => !matches(file))]
}
