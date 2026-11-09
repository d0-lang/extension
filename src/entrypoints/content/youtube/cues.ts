/** Cuts a caption track into cues of up to two lines, which show and go together. */
import type { Json3 } from "./json3"

/** `text` has its lines apart with `\n`. */
export type Cue = { startMs: number; endMs: number; text: string }

type Word = {
  text: string
  startMs: number
  speakerChange: boolean
  /** Whether the word starts inside what the segmenter reads as one word, like `方` after `使い`. No cut goes before it. */
  inSegment: boolean
}

const SEGMENTER = new Intl.Segmenter(undefined, { granularity: "word" })

/** About 42 Latin letters. A wide character, like a kanji, counts as two. */
export const LINE_WIDTH = 42

/** A cue ends at a sentence or a pause only once it has most of a line, so short sentences share a cue rather than flash by. */
const MIN_WIDTH = 32

/** What each unit of width between a cue's two lines costs, so the lines come out about even. */
const UNEVEN_MS = 60

/** Between the starts of two words, so it takes in the first word as well as the silence. */
const PAUSE_MS = 1500

/** Ends even a short cue, because joining across it would show words long before they are said. */
const LONG_PAUSE_MS = 3000

/** A Japanese particle or ending, like `に` or `して`. */
const PARTICLE = /^\p{scx=Hiragana}{1,2}$/u
const ENDS_IN_KANJI = /[\p{scx=Han}\p{scx=Katakana}]$/u
const STARTS_WITH_KANJI = /^[\p{scx=Han}\p{scx=Katakana}]/u

/** What a cut after a sentence or a clause is worth, and what one inside a word costs, as silence would be. */
const SENTENCE_END_MS = 3000
const CLAUSE_END_MS = 1500
const GLUED_COST_MS = 4000

/** How long a cue stays after its last word starts, unless the next cue comes first. */
const TAIL_MS = 2000

// Japanese auto captions have no punctuation, but polite endings close most sentences.
const SENTENCE_END = /(?:[.!?…。！？]["'»”)]*|です|ます|ました|でした|ません|ください)$/u
const CLAUSE_END = /[,;:、，]["'»”)]*$/u

/** Sounds and bleeps, like `[Musik]`, `[ __ ]` or `♪`, which have nothing to look up. */
const SOUND = /\[[^\]]*\]|♪/gu

/** A creator's cue that only describes a sound, like `(Helle Klänge)`. Parentheses inside a cue stay, because they can be part of what is said. */
const SOUND_ONLY = /^\([^)]*\)$/u

/** East Asian wide and fullwidth characters. */
const WIDE =
  /[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua960-\ua97f\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/u

/** How wide `text` shows, in Latin letters. */
export const width = (text: string): number =>
  [...text].reduce((sum, char) => sum + (WIDE.test(char) ? 2 : 1), 0)

const joinedWidth = (words: ReadonlyArray<Word>): number => width(joined(words))

const joined = (words: ReadonlyArray<Word>): string => tidy(joinLines(words.map(({ text }) => text).join("")))

/** One space between words, none at the ends. `\s` takes in no-break spaces, which creator tracks use for padding. */
const tidy = (text: string): string => text.replace(/\s+/gu, " ").trim()

/** Joins text across a line break with a space, or with nothing between two wide characters. */
const joinLines = (text: string): string =>
  text.replace(/(.?)[^\S\n]*\n\s*(.?)/gu, (_, before: string, after: string) =>
    WIDE.test(before) && WIDE.test(after) ? before + after : `${before} ${after}`,
  )

/** Marks the words that start inside a segment. The track is read whole, because the segmenter needs the words around. */
const markSegments = (words: ReadonlyArray<Omit<Word, "inSegment">>): Array<Word> => {
  let text = ""
  const starts = words.map((word) => {
    const piece = word.text.trim()
    const joinsWide = word.text.startsWith("\n") && WIDE.test(text.at(-1) ?? "") && WIDE.test(piece[0] ?? "")
    if (text !== "" && /^\s/u.test(word.text) && !joinsWide) {
      text += " "
    }
    const start = text.length
    text += piece
    return start
  })
  const boundaries = new Set(Array.from(SEGMENTER.segment(text), ({ index }) => index))
  return words.map((word, index) => ({ ...word, inSegment: !boundaries.has(starts[index]!) }))
}

// A dropped sound leaves a gap, which cuts like a pause.
const asrWords = (json3: Json3): Array<Word> =>
  markSegments(
    json3.events
      .flatMap(({ tStartMs, aAppend, segs = [] }) =>
        aAppend === 1
          ? []
          : segs.map(({ utf8, tOffsetMs = 0, isSpeakerChange }, index) => ({
              // An event's first word has no space before it, so it starts a line like in a creator track.
              // The speaker marker becomes a cut, so it would only get in the way of picking the word.
              text: (index === 0 ? "\n" : "") + utf8.replace(/^(\s*)>>\s*/u, "$1").replace(SOUND, ""),
              startMs: tStartMs + tOffsetMs,
              speakerChange: isSpeakerChange === 1,
            })),
      )
      .filter(({ text }) => text.trim() !== ""),
  )

/**
 * Whether cutting between `last` and `next` splits what reads as one word in Japanese.
 * That is a particle or ending taken from its word, or a compound like `請求書`, which auto captions cut into pieces with gaps between them.
 */
const glued = (last: Word, next: Word): boolean => {
  const before = last.text.trim()
  const after = next.text.trim()
  return PARTICLE.test(after) || (ENDS_IN_KANJI.test(before) && STARTS_WITH_KANJI.test(after))
}

const breaksBefore = (cue: ReadonlyArray<Word>, word: Word): boolean => {
  const last = cue.at(-1)
  if (last === undefined) {
    return false
  }
  const gap = word.startMs - last.startMs
  if (word.speakerChange || gap >= LONG_PAUSE_MS) {
    return true
  }
  return (
    joinedWidth(cue) >= MIN_WIDTH &&
    !word.inSegment &&
    !glued(last, word) &&
    (SENTENCE_END.test(last.text.trim()) || gap >= PAUSE_MS)
  )
}

/** How good a place it is to cut `head` from `next`, in milliseconds of silence it is worth. */
const cutScore = (head: ReadonlyArray<Word>, next: Word): number => {
  const last = head.at(-1)!
  const text = last.text.trim()
  const gap = next.startMs - last.startMs
  const ending = SENTENCE_END.test(text) ? SENTENCE_END_MS : CLAUSE_END.test(text) ? CLAUSE_END_MS : 0
  return gap + ending - (glued(last, next) ? GLUED_COST_MS : 0)
}

/** The cue's words on up to two lines, cut where it reads best and the lines come out about even. */
const linesOf = (words: ReadonlyArray<Word>): Array<ReadonlyArray<Word>> => {
  if (joinedWidth(words) <= LINE_WIDTH) {
    return [words]
  }
  type Cut = { index: number; fits: boolean; whole: boolean; score: number }
  // Keeping both lines in width comes first, then keeping words whole, then reading well.
  const better = (a: Cut, b: Cut): boolean =>
    a.fits !== b.fits ? a.fits : a.whole !== b.whole ? a.whole : a.score > b.score
  let best: Cut | undefined
  for (let index = 1; index < words.length; index++) {
    const head = joinedWidth(words.slice(0, index))
    const tail = joinedWidth(words.slice(index))
    const cut = {
      index,
      fits: head <= LINE_WIDTH && tail <= LINE_WIDTH,
      whole: !words[index]!.inSegment,
      score: cutScore(words.slice(0, index), words[index]!) - Math.abs(head - tail) * UNEVEN_MS,
    }
    if (best === undefined || better(cut, best)) {
      best = cut
    }
  }
  return best === undefined ? [words] : [words.slice(0, best.index), words.slice(best.index)]
}

/** Whether some cut puts the words on two lines that each fit, which a cue under twice a line's width can still miss. */
const fitsTwoLines = (words: ReadonlyArray<Word>): boolean =>
  linesOf(words).every((line) => joinedWidth(line) <= LINE_WIDTH)

/** Where to cut a cue that grew too wide: after a sentence or clause, or at the longest gap, keeping the head readable. */
const cutIndex = (cue: ReadonlyArray<Word>): number => {
  let best = cue.length - 1
  let bestScore = -Infinity
  for (let index = 1; index < cue.length; index++) {
    const head = cue.slice(0, index)
    if (cue[index]!.inSegment || joinedWidth(head) < MIN_WIDTH || !fitsTwoLines(head)) {
      continue
    }
    const score = cutScore(head, cue[index]!)
    // On a tie the later cut wins, so the cue comes out fuller.
    if (score >= bestScore) {
      best = index
      bestScore = score
    }
  }
  return best
}

const groupAsr = (words: ReadonlyArray<Word>): Array<Array<Word>> => {
  const groups: Array<Array<Word>> = []
  let cue: Array<Word> = []
  for (const word of words) {
    if (breaksBefore(cue, word)) {
      groups.push(cue)
      cue = []
    }
    cue.push(word)
    if (!fitsTwoLines(cue) && cue.length > 1) {
      const at = cutIndex(cue)
      groups.push(cue.slice(0, at))
      cue = cue.slice(at)
    }
  }
  return cue.length === 0 ? groups : [...groups, cue]
}

const asrCues = (json3: Json3): Array<Cue> => {
  const groups = groupAsr(asrWords(json3)).filter((words) => joined(words) !== "")
  return groups.map((words, index) => {
    const lastStart = words.at(-1)!.startMs
    const next = groups[index + 1]?.[0]?.startMs ?? Infinity
    return {
      startMs: words[0]!.startMs,
      endMs: Math.min(next, lastStart + TAIL_MS),
      text: linesOf(words).map(joined).join("\n"),
    }
  })
}

/** A creator's cues stay as they are, lines and all. */
const creatorCues = (json3: Json3): Array<Cue> => {
  const cues = json3.events.flatMap(({ tStartMs, dDurationMs, segs = [] }) => {
    const lines = segs
      .map(({ utf8 }) => utf8)
      .join("")
      .replace(SOUND, "")
      .split("\n")
      .map(tidy)
      .filter((line) => line !== "")
    return lines.length === 0 || SOUND_ONLY.test(lines.join(" "))
      ? []
      : [{ startMs: tStartMs, endMs: tStartMs + dDurationMs, text: lines.join("\n") }]
  })
  // Only one cue shows at a time, so an overlap ends at the next start.
  return cues.map((cue, index) => ({
    ...cue,
    endMs: Math.min(cue.endMs, cues[index + 1]?.startMs ?? Infinity),
  }))
}

/** Cues in the order they show, none overlapping. `asr` is whether the track is YouTube's auto captions. */
export const cuesOf = (json3: Json3, asr: boolean): Array<Cue> => (asr ? asrCues(json3) : creatorCues(json3))

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
