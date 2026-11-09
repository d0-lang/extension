import { fromThrowable } from "neverthrow"
import { collapseWhitespace, copyNumber, placeMatch } from "$lib/dict/match"
import { firstText, indexIn, rangeIn, runAround } from "./text"

/** A longer run is not one sentence, so nothing is sent. */
const MAX_SENTENCE_CHARS = 500

const createSegmenter = (locale: string | undefined): Intl.Segmenter =>
  new Intl.Segmenter(locale, { granularity: "sentence" })

// The locale comes from a server's language code, which may not be one `Intl` knows.
const segmenterFor = (locale: string | undefined): Intl.Segmenter =>
  fromThrowable(() => createSegmenter(locale))().unwrapOr(createSegmenter(undefined))

/** The sentence sent as `context`, and where the looked-up word is in it. */
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
 * The sentence or subtitle line around `range`, with whitespace collapsed.
 * Unset when it is too long, or when it does not contain `word` as picked.
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
  // One past the limit, so a sentence cut off at the edge of the run is too long to send.
  const run = runAround(from, MAX_SENTENCE_CHARS + 1)
  const text = run.text
  const start = indexIn(run, range.startContainer, range.startOffset)
  const end = indexIn(run, range.endContainer, range.endOffset)
  const segments = segmenterFor(locale).segment(text)
  const first = segments.containing(start)
  const last = segments.containing(Math.max(start, end - 1))
  if (first === undefined || last === undefined) {
    return undefined
  }
  const { text: sentence, rawIndex } = collapseWhitespace(
    text.slice(first.index, last.index + last.segment.length),
  )
  const spaced = word.replace(/\s+/g, " ")
  if (sentence.length > MAX_SENTENCE_CHARS || !sentence.includes(spaced)) {
    return undefined
  }
  const clicked = rawIndex.findIndex((index) => first.index + index >= start)
  const toRaw = (index: number) => first.index + rawIndex[index]!
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
