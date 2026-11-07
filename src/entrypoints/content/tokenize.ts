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
    // The segmenter also counts numbers as words, and a dictionary has nothing for those.
    return segment?.isWordLike === true && /\p{L}/u.test(segment.segment)
      ? [{ start: segment.index, end: segment.index + segment.segment.length }]
      : []
  })
}
