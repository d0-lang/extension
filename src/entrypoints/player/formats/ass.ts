/** ASS and SSA subtitle files: the lines their characters say or sing, without signs or drawings. */
import { styledOf, type Char, type Reading } from "$lib/subtitles/chars"
import type { Cue } from "$lib/subtitles/cues"
import type { TextStyle } from "$lib/subtitles/rows"

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
 * A karaoke syllable and its furigana: `忘|わ` is 忘 read わ, and `#|す` goes on with the reading of the one before, so
 * it has no characters of its own.
 */
const furiganaOf = (syllable: string): { base: string; reading: string | undefined } => {
  const bar = syllable.indexOf("|")
  return bar === -1
    ? { base: syllable, reading: undefined }
    : { base: syllable.slice(0, bar), reading: syllable.slice(bar + 1) }
}

/** How a style or a tag draws text. `colour` is `#rrggbb`. */
type Pen = { colour: string | undefined; italic: boolean; bold: boolean }

const PLAIN: Pen = { colour: undefined, italic: false, bold: false }

/** A colour as ASS writes it, `&HAABBGGRR` with the alpha optional, or as SSA's styles do, a number. */
const colourOf = (value: string): string | undefined => {
  const hex = /^&?H([0-9a-f]+)&?$/iu.exec(value.trim())
  const bgr =
    hex !== null ? parseInt(hex[1]!.slice(-6), 16) : /^\d+$/u.test(value.trim()) ? Number(value) : undefined
  if (bgr === undefined) {
    return undefined
  }
  return `#${[bgr & 0xff, (bgr >> 8) & 0xff, (bgr >> 16) & 0xff].map((part) => part.toString(16).padStart(2, "0")).join("")}`
}

/** The style `pen` draws in. White is how subtitles draw anyway. */
const styleOf = ({ colour, italic, bold }: Pen): TextStyle | undefined => {
  const style: TextStyle = {
    ...(colour !== undefined && colour !== "#ffffff" && { color: colour }),
    ...(italic && { italic: true }),
    ...(bold && { bold: true }),
  }
  return Object.keys(style).length === 0 ? undefined : style
}

/** A style's name, which a leading `*` does not change. */
const styleName = (name: string): string => name.trim().replace(/^\*/u, "")

/**
 * `pen` after the tags in `block`, a `{…}` of a line: `\i`, `\b`, `\c` or `\1c`, and `\r`, which goes back to the line's
 * style, `base`, or to the style it names.
 */
const overridden = (pen: Pen, block: string, base: Pen, pens: ReadonlyMap<string, Pen>): Pen =>
  block
    .slice(1, -1)
    .split("\\")
    .slice(1)
    .reduce((pen, tag) => {
      const italic = /^i([01])$/u.exec(tag)
      const bold = /^b(\d+)$/u.exec(tag)
      const colour = /^1?c(.*)$/u.exec(tag)
      const reset = /^r(.*)$/u.exec(tag)
      if (italic !== null) {
        return { ...pen, italic: italic[1] === "1" }
      }
      if (bold !== null) {
        // A weight from 100 to 900, or 1 for bold.
        return { ...pen, bold: Number(bold[1]) === 1 || Number(bold[1]) >= 600 }
      }
      if (colour !== null) {
        return { ...pen, colour: colour[1] === "" ? base.colour : (colourOf(colour[1]!) ?? pen.colour) }
      }
      if (reset !== null) {
        return reset[1] === "" ? base : (pens.get(styleName(reset[1]!)) ?? pen)
      }
      return pen
    }, pen)

/**
 * An event's text as characters, each with how it is drawn: `\N` breaks a line, and `\n` and `\h` are spaces unless
 * the file asks otherwise. A karaoke line's furigana are readings over its syllables. Every `{…}` goes, since one
 * without a backslash is a comment.
 */
const charsOf = (text: string, base: Pen, pens: ReadonlyMap<string, Pen>): Array<Char> => {
  const karaoke = KARAOKE.test(text)
  const chars: Array<Char> = []
  let pen = base
  let last: Reading | undefined
  // Split on the blocks, which leaves the text at even places.
  for (const [index, part] of text.split(/(\{[^}]*\})/u).entries()) {
    if (index % 2 === 1) {
      pen = overridden(pen, part, base, pens)
      continue
    }
    // Blocks next to each other leave nothing between them, which ends no reading.
    if (part === "") {
      continue
    }
    const { base: said, reading } = karaoke ? furiganaOf(part) : { base: part, reading: undefined }
    if (karaoke && said === "#") {
      if (last !== undefined && reading !== undefined) {
        last.text += reading
      }
      continue
    }
    last = reading === undefined || reading === "" ? undefined : { text: reading }
    const shown = said.replace(/\\N/gu, "\n").replace(/\\[nh]/gu, " ")
    const style = styleOf(pen)
    for (const char of shown.split("")) {
      chars.push({ char, style, reading: last })
    }
  }
  return chars
}

/** The fields of `value`, what follows `Dialogue:`, named by `format`. The text, which is last, may hold commas. */
const fieldsOf = (value: string, format: ReadonlyArray<string>): Map<string, string> => {
  const parts = value.split(",")
  const fields = [...parts.slice(0, format.length - 1), parts.slice(format.length - 1).join(",")]
  return new Map(format.map((name, index) => [name, fields[index] ?? ""]))
}

/** An event of the `[Events]` section: a `Dialogue:` line, or a `Comment:` one, which does not show. */
type Event = { comment: boolean; effect: string; fields: Map<string, string> }

/** The fields of a style when the file does not list them, as ASS writes them, up to the ones read. */
const DEFAULT_STYLE_FORMAT = [
  "name",
  "fontname",
  "fontsize",
  "primarycolour",
  "secondarycolour",
  "outlinecolour",
  "backcolour",
  "bold",
  "italic",
]

const penOf = (fields: Map<string, string>): Pen => ({
  colour: colourOf(fields.get("primarycolour") ?? ""),
  // `-1` is on, `0` off.
  italic: !["", "0"].includes((fields.get("italic") ?? "").trim()),
  bold: !["", "0"].includes((fields.get("bold") ?? "").trim()),
})

/** The styles of an ASS or SSA file, by name, and its events in the order the file has them. */
const sectionsOf = (text: string): { pens: Map<string, Pen>; events: Array<Event> } => {
  let section = ""
  let format = DEFAULT_FORMAT
  let styleFormat = DEFAULT_STYLE_FORMAT
  const pens = new Map<string, Pen>()
  const events: Array<Event> = []
  for (const line of text.replace(/\r\n?/gu, "\n").split("\n")) {
    const heading = /^\s*\[([^\]]+)\]\s*$/u.exec(line)
    if (heading !== null) {
      section = heading[1]!.trim().toLowerCase()
      continue
    }
    const entry = /^\s*([^:]+):\s?(.*)$/u.exec(line)
    if (entry === null) {
      continue
    }
    const kind = entry[1]!.trim().toLowerCase()
    const value = entry[2]!
    // `[V4+ Styles]` in ASS, `[V4 Styles]` in SSA.
    if (section.endsWith("styles")) {
      if (kind === "format") {
        styleFormat = value.split(",").map((name) => name.trim().toLowerCase())
      } else if (kind === "style") {
        const fields = fieldsOf(value, styleFormat)
        pens.set(styleName(fields.get("name") ?? ""), penOf(fields))
      }
      continue
    }
    if (section !== "events") {
      continue
    }
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
  return { pens, events }
}

/**
 * The cues of an ASS or SSA file, in the order the file has them, in their styles' colours, italics and bold. A song's
 * karaoke lines show whole, with their furigana over the kanji.
 * An event with an effect, a place on the picture or a drawing is left out, and so is a copy of one at the same time,
 * like a second layer drawn for its outline.
 *
 * Aegisub's karaoke templates keep each sung line as a `karaoke` comment and draw it with `fx` lines made from it, so
 * the comments are read in place of those. The `fx` lines are read only in a file without them. A sung line starts
 * after its lead-in, and sung lines that end together, like a song's kanji and its romaji, start together too, so they
 * show as one cue.
 */
export const readAss = (text: string): Array<Cue> => {
  const { pens, events } = sectionsOf(text)
  const templated = events.some(({ comment, effect }) => comment && effect === "karaoke")
  const cues: Array<Cue & { sung: boolean }> = []
  const seen = new Set<string>()
  for (const { comment, effect, fields } of events) {
    const shown = comment ? effect === "karaoke" : effect === "" || (effect === "fx" && !templated)
    const raw = fields.get("text") ?? ""
    const start = msOf(fields.get("start") ?? "")
    const endMs = msOf(fields.get("end") ?? "")
    const {
      text: said,
      styles,
      ruby,
    } = styledOf(charsOf(raw, pens.get(styleName(fields.get("style") ?? "")) ?? PLAIN, pens))
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
    cues.push({ startMs: Math.min(startMs, endMs), endMs, text: said, styles, ruby, sung: KARAOKE.test(raw) })
  }
  const sungFrom = new Map<number, number>()
  for (const { startMs, endMs, sung } of cues.filter(({ sung }) => sung)) {
    sungFrom.set(endMs, Math.min(startMs, sungFrom.get(endMs) ?? startMs))
  }
  return cues.map(({ startMs, endMs, text, styles, ruby, sung }) => ({
    startMs: sung ? sungFrom.get(endMs)! : startMs,
    endMs,
    text,
    ...(styles !== undefined && { styles }),
    ...(ruby !== undefined && { ruby }),
  }))
}
