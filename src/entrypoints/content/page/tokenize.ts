import { fromThrowable } from "neverthrow"

export type TokenSpan = { start: number; end: number }

const createSegmenter = (locale: string | undefined): Intl.Segmenter =>
  new Intl.Segmenter(locale, { granularity: "word" })

const segmenters = new Map<string, Intl.Segmenter>()

// Codes come from servers, and a code that only looks like a language makes the constructor throw.
const segmenterFor = (locale: string | undefined): Intl.Segmenter => {
  const key = locale ?? ""
  const segmenter =
    segmenters.get(key) ?? fromThrowable(() => createSegmenter(locale))().unwrapOr(createSegmenter(undefined))
  segmenters.set(key, segmenter)
  return segmenter
}

/**
 * Whether the segmenter's piece is a word a dictionary could have. It counts numbers as words too.
 * Firefox leaves `isWordLike` false on a Japanese, Chinese or Thai word before a non-word, so there any letters do.
 */
// TODO: Trust `isWordLike` in Firefox too once its segmenter is fixed.
const isWord = (segment: Intl.SegmentData): boolean =>
  (segment.isWordLike === true || import.meta.env.FIREFOX) && /\p{L}/u.test(segment.segment)

/** `text` cut into words and what lies between them, in order. `locale` is the language of the text, if known. */
export const segmentsOf = (
  text: string,
  locale: string | undefined = undefined,
): Array<{ text: string; word: boolean }> =>
  Array.from(segmenterFor(locale).segment(text), (segment) => ({
    text: segment.segment,
    word: isWord(segment),
  }))

/**
 * Word spans around a caret offset, nearest first. `locale` is the language of the text, if known.
 * A caret in the right half of a letter sits after it, so the word before the caret also counts.
 */
// TODO: Replace with the per-language tokenizers from the protocol.
export const tokensAt = (
  text: string,
  offset: number,
  locale: string | undefined = undefined,
): Array<TokenSpan> => {
  const segments = segmenterFor(locale).segment(text)
  return [offset, offset - 1].flatMap((position) => {
    const segment = segments.containing(position)
    return segment !== undefined && isWord(segment)
      ? [{ start: segment.index, end: segment.index + segment.segment.length }]
      : []
  })
}
