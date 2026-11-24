import { fromThrowable } from "neverthrow"
import { collapseWhitespace, copyNumber, excerptAround, placeMatch } from "$lib/dict/match"
import { firstText, indexIn, rangeIn, runAround } from "./text"

/** The protocol's limit on `context`: of a longer sentence, the part around the word is sent. */
const MAX_SENTENCE_CHARS = 500

const createSegmenter = (locale: string | undefined): Intl.Segmenter =>
  new Intl.Segmenter(locale, { granularity: "sentence" })

// The locale comes from a server's language code, which may not be one `Intl` knows.
const segmenterFor = (locale: string | undefined): Intl.Segmenter =>
  fromThrowable(() => createSegmenter(locale))().unwrapOr(createSegmenter(undefined))

/** The sentence sent as `context` (or the part of it around the word), and where the looked-up word is in it. */
export type Sentence = {
  text: string
  /** Which copy of the word in `text` was looked up, from 1: the protocol's `at`. */
  at: number | undefined
  /** The parts of `text` a context entry's `match` names, placed around the word. Empty when they don't fit. */
  rangesOf: (match: ReadonlyArray<string>) => Array<Range>
  /** Where the looked-up word starts inside the copy of `part` that covers it. Unset when no copy does. */
  offsetIn: (part: string) => number | undefined
}

/**
 * The sentence or subtitle line around `range`, with whitespace collapsed. Of a sentence over the
 * limit, the clauses around the word (`excerptAround`). Unset when it does not contain `word` as picked.
 */
export const sentenceAround = (
  range: Range,
  word: string,
  locale: string | undefined,
): Sentence | undefined => {
  const from = firstText(range)
  if (from === undefined) {
    return undefined
  }
  // One past the limit each way, so an excerpt never reaches a sentence cut off at the edge of the run.
  const run = runAround(from, MAX_SENTENCE_CHARS + 1)
  const text = run.text
  const start = indexIn(run, range.startContainer, range.startOffset)
  const end = indexIn(run, range.endContainer, range.endOffset)
  // The segmenter ends a sentence at every line break, which in markup is mostly just a space.
  // Each space becomes one plain space, so every index still points into `text`.
  const segments = segmenterFor(locale).segment(text.replace(/\s/gu, " "))
  const first = segments.containing(start)
  const last = segments.containing(Math.max(start, end - 1))
  if (first === undefined || last === undefined) {
    return undefined
  }
  const { text: whole, rawIndex } = collapseWhitespace(
    text.slice(first.index, last.index + last.segment.length),
  )
  const spaced = word.replace(/\s+/g, " ")
  const clickedInWhole = rawIndex.findIndex((index) => first.index + index >= start)
  const span =
    whole.length <= MAX_SENTENCE_CHARS
      ? ([0, whole.length] as [number, number])
      : clickedInWhole < 0
        ? undefined
        : excerptAround(whole, clickedInWhole, clickedInWhole + spaced.length, MAX_SENTENCE_CHARS)
  if (span === undefined) {
    return undefined
  }
  const [cut] = span
  const sentence = whole.slice(...span)
  if (!sentence.includes(spaced)) {
    return undefined
  }
  const clicked = clickedInWhole < 0 ? -1 : clickedInWhole - cut
  const toRaw = (index: number) => first.index + rawIndex[cut + index]!
  return {
    text: sentence,
    at: clicked < 0 ? undefined : copyNumber(sentence, spaced, clicked),
    rangesOf: (match) =>
      (clicked < 0 ? undefined : placeMatch(sentence, match, clicked))?.flatMap(
        ([from, to]) => rangeIn(run, toRaw(from), toRaw(to - 1) + 1) ?? [],
      ) ?? [],
    offsetIn: (part) => {
      const start = clicked < 0 ? undefined : placeMatch(sentence, [part], clicked)?.[0]?.[0]
      return start === undefined ? undefined : clicked - start
    },
  }
}
