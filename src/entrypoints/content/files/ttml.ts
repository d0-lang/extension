/** TTML subtitle files, like the EBU-TT that ARD's player downloads. */
import { styledOf, type Char } from "$lib/subtitles/chars"
import { dropUsualPlace, inOrder, type Cue } from "$lib/subtitles/cues"
import type { Place, TextStyle } from "$lib/subtitles/rows"

const TT = "http://www.w3.org/ns/ttml"
const TTS = "http://www.w3.org/ns/ttml#styling"
const TTP = "http://www.w3.org/ns/ttml#parameter"
const XML = "http://www.w3.org/XML/1998/namespace"

const CLOCK = /^(\d+):(\d{2}):(\d{2})(?:\.(\d+)|:(\d+(?:\.\d+)?))?$/u
const OFFSET = /^(\d+(?:\.\d+)?)(h|m|s|ms|f)$/u
const OFFSET_MS: Record<string, number> = { h: 3_600_000, m: 60_000, s: 1000, ms: 1 }

/** What text is drawn in when nothing names a colour, so it is no style of its own. */
const WHITE = "#ffffff"

/** `00:01:02.500`, `00:01:02:12` in frames, or an offset like `62.5s`, in milliseconds. */
export const ttmlTime = (value: string, frameRate: number): number | undefined => {
  const clock = CLOCK.exec(value.trim())
  if (clock !== null) {
    const [, hours, minutes, seconds, fraction, frames] = clock
    return (
      ((Number(hours) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000 +
      (fraction === undefined ? 0 : Number(`0.${fraction}`) * 1000) +
      (Number(frames ?? 0) * 1000) / frameRate
    )
  }
  const offset = OFFSET.exec(value.trim())
  if (offset === null) {
    return undefined
  }
  const [, count, unit] = offset
  return unit === "f" ? (Number(count) * 1000) / frameRate : Number(count) * OFFSET_MS[unit!]!
}

/** `#rrggbb`, from `#rrggbb` or `#rrggbbaa`. The colour helpers read no other way of writing one. */
const hexColour = (value: string | null): string | undefined =>
  value !== null && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/iu.test(value)
    ? value.slice(0, 7).toLowerCase()
    : undefined

/** The style an element sets with its own attributes. */
const attributeStyle = (element: Element): TextStyle => {
  const color = hexColour(element.getAttributeNS(TTS, "color"))
  const italic = element.getAttributeNS(TTS, "fontStyle")
  const bold = element.getAttributeNS(TTS, "fontWeight")
  return {
    ...(color !== undefined && { color }),
    ...(italic !== null && { italic: italic === "italic" }),
    ...(bold !== null && { bold: bold === "bold" }),
  }
}

/** The styles an element names in `style`, then its own attributes, each over the one before. */
const ownStyle = (element: Element, styles: ReadonlyMap<string, TextStyle>): TextStyle =>
  Object.assign(
    {},
    ...(element.getAttribute("style") ?? "").split(/\s+/u).map((id) => styles.get(id) ?? {}),
    attributeStyle(element),
  )

/** The style `element` and the elements around it set, the nearest winning. */
const styleAt = (element: Element | null, styles: ReadonlyMap<string, TextStyle>): TextStyle =>
  element === null || element.namespaceURI !== TT
    ? {}
    : { ...styleAt(element.parentElement, styles), ...ownStyle(element, styles) }

/** `style` as the overlay takes it: only what differs from plain white text. */
const drawnStyle = ({ color, italic, bold }: TextStyle): TextStyle | undefined => {
  const style: TextStyle = {
    ...(color !== undefined && color !== WHITE && { color }),
    ...(italic === true && { italic }),
    ...(bold === true && { bold }),
  }
  return Object.keys(style).length === 0 ? undefined : style
}

/** The characters under `node`, each with its style. A `<br>` is a line break. */
const charsOf = (node: Node, style: TextStyle, styles: ReadonlyMap<string, TextStyle>): Array<Char> => {
  if (node.nodeType === node.TEXT_NODE) {
    const drawn = drawnStyle(style)
    return [...(node.textContent ?? "")].map((char) => ({ char, style: drawn }))
  }
  if (!(node instanceof Element) || node.namespaceURI !== TT) {
    return []
  }
  if (node.localName === "br") {
    return [{ char: "\n", style: undefined }]
  }
  const inner = { ...style, ...ownStyle(node, styles) }
  return [...node.childNodes].flatMap((child) => charsOf(child, inner, styles))
}

/** Where a region puts its text: its top, middle or bottom edge, by how it aligns it. Across, the middle. */
const placeOfRegion = (region: Element): Place | undefined => {
  const percents = (name: string) =>
    (region.getAttributeNS(TTS, name) ?? "").match(/[\d.]+(?=%)/gu)?.map(Number) ?? []
  const top = percents("origin")[1]
  const height = percents("extent")[1]
  if (top === undefined || height === undefined) {
    return undefined
  }
  const align = region.getAttributeNS(TTS, "displayAlign")
  return align === "after"
    ? { anchor: 7, x: 50, y: top + height }
    : align === "center"
      ? { anchor: 4, x: 50, y: top + height / 2 }
      : { anchor: 1, x: 50, y: top }
}

const regionOf = (element: Element | null): string | undefined =>
  element === null || element.namespaceURI !== TT
    ? undefined
    : (element.getAttribute("region") ?? regionOf(element.parentElement))

/** The file's language, like `de` for `de-DE`. */
export const ttmlLanguage = (doc: Document): string | undefined =>
  doc.documentElement.getAttributeNS(XML, "lang")?.split("-")[0]?.toLowerCase() || undefined

/**
 * The cues of a TTML file, in the order they show, with their colours, italics and bold. A cue keeps its place only
 * when it is not where the file's cues mostly are.
 */
export const readTtml = (doc: Document): Array<Cue> => {
  const root = doc.documentElement
  const frameRate = Number(root.getAttributeNS(TTP, "frameRate")) || 30
  const styles = new Map<string, TextStyle>()
  for (const style of root.getElementsByTagNameNS(TT, "style")) {
    styles.set(style.getAttributeNS(XML, "id") ?? "", ownStyle(style, styles))
  }
  const places = new Map<string, Place>()
  for (const region of root.getElementsByTagNameNS(TT, "region")) {
    const place = placeOfRegion(region)
    if (place !== undefined) {
      places.set(region.getAttributeNS(XML, "id") ?? "", place)
    }
  }
  const cues = [...root.getElementsByTagNameNS(TT, "p")].flatMap((p): Array<Cue> => {
    const startMs = ttmlTime(p.getAttribute("begin") ?? "", frameRate)
    const endMs = ttmlTime(p.getAttribute("end") ?? "", frameRate)
    if (startMs === undefined || endMs === undefined) {
      return []
    }
    const { text, styles: runs } = styledOf(charsOf(p, styleAt(p.parentElement, styles), styles))
    const place = places.get(regionOf(p) ?? "")
    return [
      {
        startMs,
        endMs,
        text,
        ...(runs !== undefined && { styles: runs }),
        ...(place !== undefined && { place }),
      },
    ]
  })
  return inOrder(dropUsualPlace(cues))
}
