/** ASS and SSA subtitle files: the lines their characters say, without signs, karaoke or drawings. */
import type { Cue } from "$lib/subtitles/cues"
import { plainText } from "$lib/subtitles/markup"

/** The fields of an event when the file does not list them, as ASS writes them. */
const DEFAULT_FORMAT = [
  "layer",
  "start",
  "end",
  "style",
  "name",
  "marginl",
  "marginr",
  "marginv",
  "effect",
  "text",
]

/** `0:01:02.50`, with hundredths of a second. */
const TIME = /^(\d+):(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/u

const msOf = (time: string): number | undefined => {
  const match = TIME.exec(time.trim())
  if (match === null) {
    return undefined
  }
  const [, hours, minutes, seconds, fraction = ""] = match
  return (
    ((Number(hours) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000 + Number(fraction.padEnd(3, "0"))
  )
}

/**
 * Tags that put text somewhere on the picture, draw a shape or time a song's syllables. They mark signs, drawings
 * and karaoke, which would cut into the lines said at the same time.
 */
const NOT_SAID = /\\(?:pos|move|org|i?clip|p[1-9]|k[fo]?\d|K\d)/u

/** An event's text as a cue's: `\N` breaks a line, and `\n` and `\h` are spaces unless the file asks otherwise. */
const textOf = (text: string): string =>
  plainText(
    text
      // Every `{…}`, since one without a backslash is a comment.
      .replace(/\{[^}]*\}/gu, "")
      .replace(/\\N/gu, "\n")
      .replace(/\\[nh]/gu, " "),
  )

/** The fields of `value`, what follows `Dialogue:`, named by `format`. The text, which is last, may hold commas. */
const fieldsOf = (value: string, format: ReadonlyArray<string>): Map<string, string> => {
  const parts = value.split(",")
  const fields = [...parts.slice(0, format.length - 1), parts.slice(format.length - 1).join(",")]
  return new Map(format.map((name, index) => [name, fields[index] ?? ""]))
}

/**
 * The cues of an ASS or SSA file, as plain text, in the order the file has them. Only the `[Events]` section's
 * dialogue is read. An event with an effect, a place on the picture, a drawing or karaoke is left out, and so is a copy
 * of one at the same time, like a second layer drawn for its outline.
 */
export const readAss = (text: string): Array<Cue> => {
  let section = ""
  let format = DEFAULT_FORMAT
  const cues: Array<Cue> = []
  const seen = new Set<string>()
  for (const line of text.replace(/\r\n?/gu, "\n").split("\n")) {
    const heading = /^\s*\[([^\]]+)\]\s*$/u.exec(line)
    if (heading !== null) {
      section = heading[1]!.trim().toLowerCase()
      continue
    }
    const entry = /^\s*([^:]+):\s?(.*)$/u.exec(line)
    if (section !== "events" || entry === null) {
      continue
    }
    const [, kind, value] = entry
    if (kind!.trim().toLowerCase() === "format") {
      format = value!.split(",").map((name) => name.trim().toLowerCase())
      continue
    }
    if (kind!.trim().toLowerCase() !== "dialogue") {
      continue
    }
    const fields = fieldsOf(value!, format)
    const raw = fields.get("text") ?? ""
    const startMs = msOf(fields.get("start") ?? "")
    const endMs = msOf(fields.get("end") ?? "")
    const said = textOf(raw)
    const key = JSON.stringify([startMs, endMs, said])
    if (
      startMs === undefined ||
      endMs === undefined ||
      (fields.get("effect") ?? "").trim() !== "" ||
      NOT_SAID.test(raw) ||
      said === "" ||
      seen.has(key)
    ) {
      continue
    }
    seen.add(key)
    cues.push({ startMs, endMs, text: said })
  }
  return cues
}
