/** Cuts a caption track into cues of up to two lines, which show and go together. */
import type { Place, Shown, Styled } from "$lib/subtitles/rows"
import { SOUND, SOUND_ONLY, tidy } from "./clean"
import { creatorCues } from "./creator"
import type { Json3 } from "./json3"

/** Only a creator's cues have styles, and a place when it is not where the track's cues mostly are. */
export type Cue = Styled & { startMs: number; endMs: number; place?: Place | undefined }

type Spoken = { text: string; startMs: number; speakerChange: boolean }

type Word = Spoken & {
  /** The word as it shows, and whether a space shows before it when it follows the word before. */
  shown: string
  spaced: boolean
  /** Where the word starts and ends with the whole track on one line, in `width` units. */
  left: number
  right: number
  /**
   * Whether the word starts inside what the segmenter reads as one word, like `方` after `使い`,
   * or is punctuation that belongs to the word before. No cut goes before it.
   */
  inSegment: boolean
  /** How good a place it is to cut before the word, in milliseconds of silence it is worth. */
  cutWorth: number
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

/** What a cut after a sentence or a clause is worth, and what one inside a word or after a short word costs, as silence would be. */
const SENTENCE_END_MS = 3000
const CLAUSE_END_MS = 1500
const GLUED_COST_MS = 4000
const SHORT_WORD_COST_MS = 1500

/** How long a cue stays after its last word starts, unless the next cue comes first. */
const TAIL_MS = 2000

// Japanese auto captions have no punctuation, but polite endings close most sentences.
const SENTENCE_END = /(?:[.!?…。！？]["'»”)]*|です|ます|ました|でした|ません|ください)$/u
const CLAUSE_END = /[,;:、，]["'»”)]*$/u

/** Punctuation that belongs to the word before. Some tracks send it as a piece of its own, even at the start of a line. */
const ATTACHED = /^[.,!?;:…)\]}、。，．！？：；]/u

/** Where auto captions mark a new speaker, at the start of a word or a line. */
const SPEAKER = /^(\s*)>>\s*/u

/** East Asian wide and fullwidth characters. */
const WIDE =
  /[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua960-\ua97f\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/u

/**
 * Whether `text` is a word of up to three letters, like `le`, `je` or `j'ai`, which mostly leads into the word after it.
 * A word with punctuation ends something, and wide scripts have no spaces to tell their words apart.
 */
const isShortWord = (text: string): boolean =>
  /^[\p{L}'’]+$/u.test(text) && !WIDE.test(text) && text.replace(/['’]/gu, "").length <= 3

/** How wide `text` shows, in Latin letters. */
export const width = (text: string): number =>
  [...text].reduce((sum, char) => sum + (WIDE.test(char) ? 2 : 1), 0)

/** Read off where the words lie. Every cut tried asks for a width, and measuring the text each time is slow on a long track. */
const joinedWidth = (words: ReadonlyArray<Word>): number =>
  words.length === 0 ? 0 : words.at(-1)!.right - words[0]!.left

const joined = (words: ReadonlyArray<Pick<Word, "shown" | "spaced">>): string =>
  words.map(({ shown, spaced }, index) => (index > 0 && spaced ? " " : "") + shown).join("")

/** What joins two lines: a space, or nothing between two wide characters. */
const joint = (before: string, after: string): string =>
  WIDE.test(before.at(-1) ?? "") && WIDE.test(after[0] ?? "") ? "" : " "

/** Joins text across a line break. */
export const joinLines = (text: string): string =>
  text.replace(
    /(.?)[^\S\n]*\n\s*(.?)/gu,
    (_, before: string, after: string) => before + joint(before, after) + after,
  )

/** Lays the track out on one line: a space between words, or nothing between two wide characters a line break parts. */
const layOut = (words: ReadonlyArray<Spoken>): Array<Omit<Word, "inSegment" | "cutWorth">> => {
  let before: { text: string; shown: string; right: number } | undefined
  return words.map((word) => {
    const shown = tidy(joinLines(word.text))
    const gap = before === undefined ? "" : /\s*$/u.exec(before.text)![0] + /^\s*/u.exec(word.text)![0]
    const joinsWide = gap.includes("\n") && WIDE.test(before?.shown.at(-1) ?? "") && WIDE.test(shown[0] ?? "")
    const spaced = gap !== "" && !joinsWide && !ATTACHED.test(shown)
    const left = (before?.right ?? 0) + (spaced ? 1 : 0)
    before = { text: word.text, shown, right: left + width(shown) }
    return { ...word, shown, spaced, left, right: before.right }
  })
}

/** Whether each word starts inside a segment. The track is read whole, because the segmenter needs the words around. */
const startsInSegment = (words: ReadonlyArray<Pick<Word, "shown" | "spaced">>): Array<boolean> => {
  const boundaries = new Set(Array.from(SEGMENTER.segment(joined(words)), ({ index }) => index))
  let end = 0
  return words.map(({ shown, spaced }, index) => {
    const start = end + (index > 0 && spaced ? 1 : 0)
    end = start + shown.length
    return !boundaries.has(start)
  })
}

// A dropped sound leaves a gap, which cuts like a pause.
const asrWords = (json3: Json3): Array<Word> => {
  const words = layOut(
    json3.events
      .flatMap(({ tStartMs, aAppend, segs = [] }) =>
        aAppend === 1
          ? []
          : segs.map(({ utf8, tOffsetMs = 0, isSpeakerChange }, index) => ({
              // An event's first word has no space before it, so it starts a line like in a creator track.
              // The speaker marker becomes a cut, so it would only get in the way of picking the word.
              text: (index === 0 ? "\n" : "") + utf8.replace(SPEAKER, "$1").replace(SOUND, ""),
              startMs: tStartMs + tOffsetMs,
              speakerChange: isSpeakerChange === 1,
            })),
      )
      .filter(({ text }) => text.trim() !== ""),
  )
  const inSegment = startsInSegment(words)
  return words.map((word, index) => ({
    ...word,
    inSegment: inSegment[index]! || ATTACHED.test(word.shown),
    cutWorth: index === 0 ? 0 : cutScore(words[index - 1]!, word),
  }))
}

/**
 * Whether cutting between `last` and `next` splits what reads as one word in Japanese.
 * That is a particle or ending taken from its word, or a compound like `請求書`, which auto captions cut into pieces with gaps between them.
 */
const glued = (last: Spoken, next: Spoken): boolean => {
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
    !isShortWord(last.text.trim()) &&
    (SENTENCE_END.test(last.text.trim()) || gap >= PAUSE_MS)
  )
}

/** How good a place it is to cut between `last` and `next`, in milliseconds of silence it is worth. */
const cutScore = (last: Spoken, next: Spoken): number => {
  const text = last.text.trim()
  const gap = next.startMs - last.startMs
  const ending = SENTENCE_END.test(text) ? SENTENCE_END_MS : CLAUSE_END.test(text) ? CLAUSE_END_MS : 0
  return gap + ending - (glued(last, next) ? GLUED_COST_MS : 0) - (isShortWord(text) ? SHORT_WORD_COST_MS : 0)
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
      score: words[index]!.cutWorth - Math.abs(head - tail) * UNEVEN_MS,
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
    const score = cue[index]!.cutWorth
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

/** A cue and whether a new speaker starts it. */
type Kept = Cue & { speaker: boolean }

/** YouTube's own cues of auto captions, lines and all. */
const keptCues = (json3: Json3): Array<Kept> => {
  const cues = json3.events.flatMap(({ tStartMs, dDurationMs, segs = [] }) => {
    const lines = segs
      .map(({ utf8 }) => utf8)
      .join("")
      .replace(SOUND, "")
      .split("\n")
      .map((line) => ({ text: tidy(line.replace(SPEAKER, "$1")), speaker: SPEAKER.test(line) }))
      .filter(({ text }) => text !== "")
    return lines.length === 0 || SOUND_ONLY.test(lines.map(({ text }) => text).join(" "))
      ? []
      : [
          {
            startMs: tStartMs,
            endMs: tStartMs + dDurationMs,
            text: asrLines(lines),
            speaker: lines[0]!.speaker,
          },
        ]
  })
  // Only one cue shows at a time, so an overlap ends at the next start.
  return cues.map((cue, index) => ({
    ...cue,
    endMs: Math.min(cue.endMs, cues[index + 1]?.startMs ?? Infinity),
  }))
}

/** Auto captions break their lines to fit YouTube's own box, so only a new speaker keeps a line of its own. */
const asrLines = (lines: ReadonlyArray<{ text: string; speaker: boolean }>): string =>
  lines.reduce(
    (text, line, index) =>
      index === 0 ? line.text : text + (line.speaker ? "\n" : joint(text, line.text)) + line.text,
    "",
  )

/** How many short words at most leave the end of a cue for the next one. */
const MAX_MOVED_WORDS = 2

/** A cue of this many words or fewer joins the one before. */
const MAX_LONE_WORDS = 3

/** Cues further apart than this stay as they are, since joining them would show words long before they are said. */
const JOIN_GAP_MS = 1000

const wordCount = (text: string): number =>
  Array.from(SEGMENTER.segment(text)).filter(({ isWordLike }) => isWordLike).length

/** `text` without the short words it ends on, and those words. A word on a line of its own stays. */
const shortTail = (text: string, moved: Array<string> = []): { kept: string; moved: Array<string> } => {
  const last = / (\S+)$/u.exec(text)
  return last === null || moved.length === MAX_MOVED_WORDS || !isShortWord(last[1]!)
    ? { kept: text, moved }
    : shortTail(text.slice(0, last.index), [last[1]!, ...moved])
}

/**
 * Auto captions YouTube cut itself, mended where it cut badly. Short words at a cue's end, like `vers la`, go
 * to the next cue, which starts with what they lead into. A cue left with only a few words joins the one before.
 * The words moved are said right where the cues meet, so they show at about the same time.
 */
const mendAsr = (cues: ReadonlyArray<Kept>): Array<Cue> => {
  const moved = cues.map((cue) => ({ ...cue }))
  for (const [index, cue] of moved.entries()) {
    const next = moved[index + 1]
    if (next === undefined || next.speaker || next.startMs - cue.endMs > JOIN_GAP_MS) {
      continue
    }
    const tail = shortTail(cue.text)
    if (tail.moved.length > 0) {
      const words = tail.moved.join(" ")
      cue.text = tail.kept
      next.text = words + joint(words, next.text) + next.text
    }
  }
  return moved.reduce<Array<Cue>>((done, { startMs, endMs, text, speaker }) => {
    const before = done.at(-1)
    if (
      before !== undefined &&
      !speaker &&
      wordCount(text) <= MAX_LONE_WORDS &&
      startMs - before.endMs <= JOIN_GAP_MS
    ) {
      return [
        ...done.slice(0, -1),
        { startMs: before.startMs, endMs, text: before.text + joint(before.text, text) + text },
      ]
    }
    return [...done, { startMs, endMs, text }]
  }, [])
}

/** Whether any word has a time of its own. */
const timed = (json3: Json3): boolean =>
  json3.events.some(({ segs = [] }) => segs.some(({ tOffsetMs }) => tOffsetMs !== undefined))

/**
 * Cues in the order they show, none overlapping. `asr` is whether the track is YouTube's auto captions.
 * Auto captions are cut here only when their words are timed. Without timings, as in a translation or in
 * YouTube's newer format of one event per cue, they keep YouTube's cues, mended on one line each.
 * A creator's cues stay as they are.
 */
export const cuesOf = (json3: Json3, asr: boolean): Array<Cue> =>
  asr && timed(json3) ? asrCues(json3) : asr ? mendAsr(keptCues(json3)) : creatorCues(json3)

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
