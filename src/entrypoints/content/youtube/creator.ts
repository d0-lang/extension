/** A creator's cues, with the pens they are drawn with and where the creator put them. */
import { styledOf, type Char } from "$lib/subtitles/chars"
import type { Place, TextStyle } from "$lib/subtitles/rows"
import { SOUND, SOUND_ONLY } from "./clean"
import { dropUsualPlace, type Cue } from "$lib/subtitles/cues"
import type { Json3 } from "./json3"

type Pen = NonNullable<Json3["pens"]>[number]

type Event = Json3["events"][number]

/** What a pen draws in when it names no colour, so it is no style of its own. */
const WHITE = 0xffffff

/** Where YouTube puts a cue whose window names no place: by its bottom centre, at the bottom centre. */
const BOTTOM_CENTRE: Place = { anchor: 7, x: 50, y: 100 }

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
    const { text, styles } = styledOf(charsOf(event, json3.pens))
    if (text === "" || SOUND_ONLY.test(text.replace(/\n/gu, " "))) {
      return []
    }
    return [
      {
        startMs: event.tStartMs,
        endMs: event.tStartMs + event.dDurationMs,
        text,
        ...(styles !== undefined && { styles }),
        place: placeOf(event, json3),
      },
    ]
  })
  // Only one cue shows at a time, so an overlap ends at the next start.
  return dropUsualPlace(
    cues.map((cue, index) => ({ ...cue, endMs: Math.min(cue.endMs, cues[index + 1]?.startMs ?? Infinity) })),
  )
}
