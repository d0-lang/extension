/** Cues of a subtitle track, and what of them shows at a time. */
import type { Place, Shown, Styled } from "$lib/subtitles/rows"

/** `text` has its lines apart with `\n`. Styles and a place come only with tracks that set them, like a creator's on YouTube. */
export type Cue = Styled & { startMs: number; endMs: number; place?: Place | undefined }

const indexAt = (cues: ReadonlyArray<Cue>, ms: number): number | undefined => {
  let low = 0
  let high = cues.length - 1
  while (low <= high) {
    const middle = (low + high) >> 1
    const cue = cues[middle]!
    if (ms < cue.startMs) {
      high = middle - 1
    } else if (ms >= cue.endMs) {
      low = middle + 1
    } else {
      return middle
    }
  }
  return undefined
}

/** The cue showing at `ms`, if any. */
export const cueAt = (cues: ReadonlyArray<Cue>, ms: number): Cue | undefined => {
  const index = indexAt(cues, ms)
  return index === undefined ? undefined : cues[index]
}

/** The previous cue shows above the current one unless it ended longer ago than this before the current one began. */
const PREVIOUS_GAP_MS = 3000

/** A cue on screen for less than this is short, for telling fast tracks apart. */
const SHORT_CUE_MS = 2000

/** A track is fast when at least this share of the cues that follow another follow a short one. */
const FAST_SHARE = 0.5

/** Whether most cues follow a short one, like quick back-and-forth dialogue, which would keep a slide going. */
export const isFast = (cues: ReadonlyArray<Cue>): boolean => {
  const before = cues.flatMap((cue, index) => {
    const last = cues[index - 1]
    return last !== undefined && cue.startMs - last.endMs <= PREVIOUS_GAP_MS
      ? [last.endMs - last.startMs]
      : []
  })
  return before.length > 0 && before.filter((ms) => ms < SHORT_CUE_MS).length >= before.length * FAST_SHARE
}

/**
 * What shows at `ms`, if anything. The cue before shows above only when it was in the same place.
 * `styled` is whether the styles and places cues come with show.
 */
export const shownAt = (cues: ReadonlyArray<Cue>, ms: number, styled: boolean): Shown | undefined => {
  const index = indexAt(cues, ms)
  if (index === undefined) {
    return undefined
  }
  const { text, styles, place, startMs } = cues[index]!
  const before = cues[index - 1]
  const follows =
    before !== undefined &&
    startMs - before.endMs <= PREVIOUS_GAP_MS &&
    (!styled || JSON.stringify(before.place) === JSON.stringify(place))
  return {
    text,
    styles: styled ? styles : undefined,
    place: styled ? place : undefined,
    previous: follows ? { text: before.text, styles: styled ? before.styles : undefined } : undefined,
  }
}
