/** A creator's cues, with the pens they are drawn with and where the creator put them. */
import type { Place, StyleRun, TextStyle } from "$lib/subtitles/rows"
import { SOUND, SOUND_ONLY } from "./clean"
import type { Cue } from "../subtitles/cues"
import type { Json3 } from "./json3"

type Pen = NonNullable<Json3["pens"]>[number]

type Event = Json3["events"][number]

/** What a pen draws in when it names no colour, so it is no style of its own. */
const WHITE = 0xffffff

/** Where YouTube puts a cue whose window names no place: by its bottom centre, at the bottom centre. */
const BOTTOM_CENTRE: Place = { anchor: 7, x: 50, y: 100 }

/** A character of a cue, and how it is drawn. */
type Char = { char: string; style: TextStyle | undefined }

const styleOf = (pen: Pen | undefined): TextStyle | undefined => {
  const style: TextStyle = {
    ...(pen?.fcForeColor !== undefined &&
      pen.fcForeColor !== WHITE && { color: `#${pen.fcForeColor.toString(16).padStart(6, "0")}` }),
    ...(pen?.iAttr === 1 && { italic: true }),
    ...(pen?.bAttr === 1 && { bold: true }),
  }
  return Object.keys(style).length === 0 ? undefined : style
}

/** An event's characters without sounds. Code units rather than code points, so they line up with where a sound matched. */
const charsOf = ({ segs = [], pPenId }: Event, pens: Json3["pens"]): Array<Char> => {
  const chars = segs.flatMap(({ utf8, pPenId: segPen }) => {
    const style = styleOf(pens?.[segPen ?? pPenId ?? 0])
    return Array.from({ length: utf8.length }, (_, index): Char => ({ char: utf8[index]!, style }))
  })
  const text = chars.map(({ char }) => char).join("")
  const dropped = new Set(
    [...text.matchAll(SOUND)].flatMap(({ index, 0: sound }) =>
      Array.from({ length: sound.length }, (_, offset) => index + offset),
    ),
  )
  return chars.filter((_, index) => !dropped.has(index))
}

/** One space between words, none at the ends, as `tidy` makes them. A space keeps the style of the first it stands for. */
const tidyLine = (line: ReadonlyArray<Char>): Array<Char> => {
  const tidied: Array<Char> = []
  for (const char of line) {
    if (!/\s/u.test(char.char)) {
      tidied.push(char)
    } else if (tidied.length > 0 && tidied.at(-1)!.char !== " ") {
      tidied.push({ char: " ", style: char.style })
    }
  }
  if (tidied.at(-1)?.char === " ") {
    tidied.pop()
  }
  return tidied
}

const sameStyle = (a: TextStyle, b: TextStyle): boolean => JSON.stringify(a) === JSON.stringify(b)

const styleIn = ({ from: _from, to: _to, ...style }: StyleRun): TextStyle => style

/** Where each style runs. Unstyled text has none. */
const runsOf = (chars: ReadonlyArray<Char>): Array<StyleRun> => {
  const runs: Array<StyleRun> = []
  for (const [index, { style }] of chars.entries()) {
    const last = runs.at(-1)
    if (style === undefined) {
      continue
    }
    if (last !== undefined && last.to === index && sameStyle(styleIn(last), style)) {
      last.to = index + 1
    } else {
      runs.push({ ...style, from: index, to: index + 1 })
    }
  }
  return runs
}

const placeOf = (event: Event, json3: Json3): Place => {
  const position = event.wpWinPosId === undefined ? undefined : json3.wpWinPositions?.[event.wpWinPosId]
  return {
    anchor: position?.apPoint ?? BOTTOM_CENTRE.anchor,
    x: position?.ahHorPos ?? BOTTOM_CENTRE.x,
    y: position?.avVerPos ?? BOTTOM_CENTRE.y,
  }
}

/**
 * A creator's cues, lines and styles as they are. A cue keeps its place only when it is not where the track's cues
 * mostly are, which is where the subtitles start anyway.
 */
export const creatorCues = (json3: Json3): Array<Cue> => {
  const cues = json3.events.flatMap((event) => {
    const lines = charsOf(event, json3.pens)
      .reduce<Array<Array<Char>>>(
        (lines, char) => (char.char === "\n" ? [...lines, []] : (lines.at(-1)!.push(char), lines)),
        [[]],
      )
      .map(tidyLine)
      .filter((line) => line.length > 0)
    const chars = lines.flatMap((line, index) => [
      ...(index === 0 ? [] : [{ char: "\n", style: undefined }]),
      ...line,
    ])
    const text = chars.map(({ char }) => char).join("")
    if (text === "" || SOUND_ONLY.test(text.replace(/\n/gu, " "))) {
      return []
    }
    const styles = runsOf(chars)
    return [
      {
        startMs: event.tStartMs,
        endMs: event.tStartMs + event.dDurationMs,
        text,
        ...(styles.length > 0 && { styles }),
        place: placeOf(event, json3),
      },
    ]
  })
  const counts = new Map<string, number>()
  for (const { place } of cues) {
    const key = JSON.stringify(place)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const usual = [...counts].reduce<[string, number] | undefined>(
    (most, entry) => (most === undefined || entry[1] > most[1] ? entry : most),
    undefined,
  )?.[0]
  // Only one cue shows at a time, so an overlap ends at the next start.
  return cues.map(({ place, ...cue }, index) => ({
    ...cue,
    endMs: Math.min(cue.endMs, cues[index + 1]?.startMs ?? Infinity),
    ...(JSON.stringify(place) !== usual && { place }),
  }))
}
