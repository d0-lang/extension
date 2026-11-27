/** The text of a cue as subtitle files mark it up, like WebVTT and SRT. */
import { styledOf, type Char } from "./chars"
import type { Styled, TextStyle } from "./rows"

/** Entities a cue's text may hold, as WebVTT writes them. */
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
  "&lrm;": "‎",
  "&rlm;": "‏",
}

/**
 * A cue's text without its tags, like `<i>`, a speaker's `<v Anna>` or the `{\an8}` SRT files take from ASS, with one
 * space between words and no empty lines.
 */
export const plainText = (text: string): string =>
  text
    .replace(/<[^>]*>/gu, "")
    .replace(/\{\\[^}]*\}/gu, "")
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp|lrm|rlm);/gu, (entity) => ENTITIES[entity]!)
    .split("\n")
    .map((line) => line.replace(/\s+/gu, " ").trim())
    .filter((line) => line !== "")
    .join("\n")

/** Colours by name, for WebVTT's colour classes and the names its style blocks and SRT's `<font>` use. */
const NAMED = new Map([
  ["white", "#ffffff"],
  ["black", "#000000"],
  ["red", "#ff0000"],
  ["lime", "#00ff00"],
  ["green", "#008000"],
  ["blue", "#0000ff"],
  ["yellow", "#ffff00"],
  ["cyan", "#00ffff"],
  ["aqua", "#00ffff"],
  ["magenta", "#ff00ff"],
  ["fuchsia", "#ff00ff"],
  ["orange", "#ffa500"],
  ["gray", "#808080"],
  ["grey", "#808080"],
])

/** What text is drawn in when nothing names a colour, so it is no style of its own. */
const WHITE = "#ffffff"

/** `value` as `#rrggbb`, from a name, `#rgb` or `#rrggbb`. Nothing for another way of writing a colour. */
export const hexColour = (value: string): string | undefined => {
  const colour = value.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/u.test(colour)) {
    return colour
  }
  if (/^#[0-9a-f]{3}$/u.test(colour)) {
    return `#${[...colour.slice(1)].map((digit) => digit + digit).join("")}`
  }
  return NAMED.get(colour)
}

/** A tag that styles what it holds, with its classes and attributes; any other tag; an ASS override; an entity; text. */
const TOKEN =
  /<(\/?)([a-z]+)((?:\.[\w-]+)*)([^>]*)>|<[^>]*>|\{\\[^}]*\}|&(?:amp|lt|gt|quot|#39|nbsp|lrm|rlm);|[^<{&]+|[<{&]/gu

/** How a tag styles what it holds. A class's colour comes from `colours`, or else from WebVTT's colour names. */
const tagStyle = (
  tag: string,
  classes: string,
  attributes: string,
  colours: ReadonlyMap<string, string>,
): TextStyle => {
  if (tag === "i") {
    return { italic: true }
  }
  if (tag === "b") {
    return { bold: true }
  }
  const named =
    tag === "font"
      ? /color\s*=\s*["']?([^"'\s>]+)/iu.exec(attributes)?.[1]
      : classes
          .split(".")
          .filter((name) => name !== "")
          .map((name) => colours.get(name) ?? NAMED.get(name))
          .find((colour) => colour !== undefined)
  const color = named === undefined ? undefined : hexColour(named)
  return color === undefined ? {} : { color }
}

/** `style` as the overlay takes it: only what differs from plain white text. */
const drawnStyle = ({ color, italic, bold }: TextStyle): TextStyle | undefined => {
  const style: TextStyle = {
    ...(color !== undefined && color !== WHITE && { color }),
    ...(italic === true && { italic }),
    ...(bold === true && { bold }),
  }
  return Object.keys(style).length === 0 ? undefined : style
}

/**
 * A cue's text and its styles, from the tags that style it: WebVTT's classes, like `<c.yellow>`, with the colours of
 * `colours` or WebVTT's own names, `<i>`, `<b>`, and SRT's `<font color>`. Other tags go, and spaces are tidied as
 * `plainText` tidies them.
 */
export const styledText = (text: string, colours: ReadonlyMap<string, string> = new Map()): Styled => {
  const open: Array<{ tag: string; style: TextStyle }> = []
  const chars: Array<Char> = []
  for (const [token, close, tag, classes = "", attributes = ""] of text.matchAll(TOKEN)) {
    if (tag !== undefined) {
      if (close === "/") {
        const at = open.findLastIndex((entry) => entry.tag === tag)
        open.splice(at < 0 ? open.length : at)
      } else {
        open.push({ tag, style: tagStyle(tag, classes, attributes, colours) })
      }
    } else if (!token.startsWith("<") || token === "<") {
      if (!token.startsWith("{\\")) {
        const style = drawnStyle(Object.assign({}, ...open.map((entry) => entry.style)))
        for (const char of ENTITIES[token] ?? token) {
          chars.push({ char, style })
        }
      }
    }
  }
  return styledOf(chars)
}
