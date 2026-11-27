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

/**
 * `cues` with a place kept only where it is not the one most of them have, which is where the subtitles start anyway.
 */
export const dropUsualPlace = (cues: ReadonlyArray<Cue>): Array<Cue> => {
  const counts = new Map<string, number>()
  for (const { place } of cues) {
    const key = JSON.stringify(place)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const usual = [...counts].reduce<[string, number] | undefined>(
    (most, entry) => (most === undefined || entry[1] > most[1] ? entry : most),
    undefined,
  )?.[0]
  return cues.map(({ place, ...cue }) => ({
    ...cue,
    ...(JSON.stringify(place) !== usual && { place }),
  }))
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

/** The last cue that ended at or before `ms`, if any. */
const endedAt = (cues: ReadonlyArray<Cue>, ms: number): number | undefined => {
  let low = 0
  let high = cues.length - 1
  while (low <= high) {
    const middle = (low + high) >> 1
    if (cues[middle]!.endMs <= ms) {
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return high < 0 ? undefined : high
}

/** What shows while the cue at `index` does. */
const shownOf = (cues: ReadonlyArray<Cue>, index: number, styled: boolean): Shown => {
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

/**
 * What shows at `ms`, if anything. The cue before shows above only when it was in the same place.
 * `styled` is whether the styles and places cues come with show.
 * In the silence after a cue, it stays held for as long as it would wait above the next one, so its last words can
 * still be clicked.
 */
export const shownAt = (cues: ReadonlyArray<Cue>, ms: number, styled: boolean): Shown | undefined => {
  const index = indexAt(cues, ms)
  if (index !== undefined) {
    return shownOf(cues, index, styled)
  }
  const ended = endedAt(cues, ms)
  return ended === undefined || ms - cues[ended]!.endMs >= PREVIOUS_GAP_MS
    ? undefined
    : { ...shownOf(cues, ended, styled), held: true }
}

/**
 * `cues` in the order they show, one at a time, without empty ones. Cues that start together, like two speakers', are
 * one cue with a line each, and an overlap ends at the next start.
 */
export const inOrder = (cues: ReadonlyArray<Cue>): Array<Cue> => {
  const sorted = cues
    .filter(({ text }) => text !== "")
    // Of cues that start together, the one ending first is mostly said first. The browser lists it last.
    .toSorted((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  const together: Array<Cue> = []
  for (const cue of sorted) {
    const last = together.at(-1)
    if (last !== undefined && last.startMs === cue.startMs) {
      const styles = [
        ...(last.styles ?? []),
        // Past the first cue's text and the line break after it.
        ...(cue.styles ?? []).map((run) => ({
          ...run,
          from: run.from + last.text.length + 1,
          to: run.to + last.text.length + 1,
        })),
      ]
      together[together.length - 1] = {
        ...last,
        endMs: Math.max(last.endMs, cue.endMs),
        text: `${last.text}\n${cue.text}`,
        ...(styles.length > 0 && { styles }),
      }
    } else {
      together.push(cue)
    }
  }
  return together
    .map((cue, index) => ({ ...cue, endMs: Math.min(cue.endMs, together[index + 1]?.startMs ?? Infinity) }))
    .filter(({ startMs, endMs }) => startMs < endMs)
}
