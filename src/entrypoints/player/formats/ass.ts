/** ASS and SSA subtitle files: the lines their characters say or sing, without signs or drawings. */
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
 * Tags that put text somewhere on the picture or draw a shape. They mark signs and drawings, which would cut into the
 * lines said at the same time, and karaoke effects made one syllable at a time.
 */
const NOT_SAID = /\\(?:pos|move|org|i?clip|p[1-9])/u

/** A karaoke tag, which times the syllable after it. */
const KARAOKE = /\\[kK][fo]?\d/u

/** A karaoke line's lead-in: a first syllable with no text, in hundredths of a second, before the first sung one. */
const LEAD_IN = /^\{[^}]*?\\[kK][fo]?(\d+)[^}]*\}(?=\{)/u

/**
 * A karaoke syllable without its furigana: `忘|わ` is 忘 read わ, and `#|す` goes on with the reading of the one
 * before, so it has nothing of its own.
 */
const withoutFurigana = (syllable: string): string => {
  const bar = syllable.indexOf("|")
  if (bar === -1) {
    return syllable
  }
  const base = syllable.slice(0, bar)
  return base === "#" ? "" : base
}

/**
 * An event's text as a cue's: `\N` breaks a line, and `\n` and `\h` are spaces unless the file asks otherwise. A
 * karaoke line loses the readings over its syllables.
 */
const textOf = (text: string): string =>
  plainText(
    (KARAOKE.test(text)
      ? // Split on the tags, which leaves the syllables at even places.
        text
          .split(/(\{[^}]*\})/u)
          .map((part, index) => (index % 2 === 0 ? withoutFurigana(part) : part))
          .join("")
      : text
    )
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

/** An event of the `[Events]` section: a `Dialogue:` line, or a `Comment:` one, which does not show. */
type Event = { comment: boolean; effect: string; fields: Map<string, string> }

/** The events of an ASS or SSA file, in the order the file has them. */
const eventsOf = (text: string): Array<Event> => {
  let section = ""
  let format = DEFAULT_FORMAT
  const events: Array<Event> = []
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
    const kind = entry[1]!.trim().toLowerCase()
    const value = entry[2]!
    if (kind === "format") {
      format = value.split(",").map((name) => name.trim().toLowerCase())
    } else if (kind === "dialogue" || kind === "comment") {
      const fields = fieldsOf(value, format)
      events.push({
        comment: kind === "comment",
        effect: (fields.get("effect") ?? "").trim().toLowerCase(),
        fields,
      })
    }
  }
  return events
}

/**
 * The cues of an ASS or SSA file, as plain text, in the order the file has them. A song's karaoke lines show whole.
 * An event with an effect, a place on the picture or a drawing is left out, and so is a copy of one at the same time,
 * like a second layer drawn for its outline.
 *
 * Aegisub's karaoke templates keep each sung line as a `karaoke` comment and draw it with `fx` lines made from it, so
 * the comments are read in place of those. The `fx` lines are read only in a file without them. A sung line starts
 * after its lead-in, and sung lines that end together, like a song's kanji and its romaji, start together too, so they
 * show as one cue.
 */
export const readAss = (text: string): Array<Cue> => {
  const events = eventsOf(text)
  const templated = events.some(({ comment, effect }) => comment && effect === "karaoke")
  const cues: Array<Cue & { sung: boolean }> = []
  const seen = new Set<string>()
  for (const { comment, effect, fields } of events) {
    const shown = comment ? effect === "karaoke" : effect === "" || (effect === "fx" && !templated)
    const raw = fields.get("text") ?? ""
    const start = msOf(fields.get("start") ?? "")
    const endMs = msOf(fields.get("end") ?? "")
    const said = textOf(raw)
    const key = JSON.stringify([start, endMs, said])
    if (
      !shown ||
      start === undefined ||
      endMs === undefined ||
      NOT_SAID.test(raw) ||
      said === "" ||
      seen.has(key)
    ) {
      continue
    }
    seen.add(key)
    const startMs = start + Number(LEAD_IN.exec(raw)?.[1] ?? 0) * 10
    cues.push({ startMs: Math.min(startMs, endMs), endMs, text: said, sung: KARAOKE.test(raw) })
  }
  const sungFrom = new Map<number, number>()
  for (const { startMs, endMs, sung } of cues.filter(({ sung }) => sung)) {
    sungFrom.set(endMs, Math.min(startMs, sungFrom.get(endMs) ?? startMs))
  }
  return cues.map(({ startMs, endMs, text, sung }) => ({
    startMs: sung ? sungFrom.get(endMs)! : startMs,
    endMs,
    text,
  }))
}
