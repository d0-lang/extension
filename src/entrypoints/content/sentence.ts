import { fromThrowable } from "neverthrow"
import { collapseWhitespace, copyNumber, placeMatch } from "$lib/dict/match"

/** A longer run is not one sentence, so nothing is sent. */
const MAX_SENTENCE_CHARS = 500

const isInline = (element: Element): boolean => {
  const display = getComputedStyle(element).display
  return display === "inline" || display === "contents"
}

/** The nearest ancestor that is not inline, like a paragraph or a subtitle line. */
const blockOf = (node: Node): Element | null => {
  const element = node instanceof Element ? node : node.parentElement
  return element === null || !isInline(element) || element.parentElement === null
    ? element
    : blockOf(element.parentElement)
}

const createSegmenter = (locale: string | undefined): Intl.Segmenter =>
  new Intl.Segmenter(locale, { granularity: "sentence" })

// The locale comes from a server's language code, which may not be one `Intl` knows.
const segmenterFor = (locale: string | undefined): Intl.Segmenter =>
  fromThrowable(() => createSegmenter(locale))().unwrapOr(createSegmenter(undefined))

/** Length of the block's text before `node` at `offset`, counted the way `textContent` counts it. */
const offsetIn = (block: Element, node: Node, offset: number): number => {
  const before = document.createRange()
  before.setStart(block, 0)
  before.setEnd(node, offset)
  return before.toString().length
}

/** The sentence sent as `context`, and where the looked-up word is in it. */
export type Sentence = {
  text: string
  /** Which copy of the word in `text` was looked up, from 1: the protocol's `at`. */
  at: number | undefined
  /** Boxes of the parts of `text` a context entry's `match` names, placed around the word. Empty when they don't fit. */
  rectsOf: (match: ReadonlyArray<string>) => Array<DOMRect>
}

/** A DOM position for the character at `index` of `block`'s text. */
const positionIn = (block: Element, index: number): { node: Node; offset: number } | undefined => {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  let seen = 0
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0
    if (index <= seen + length) {
      return { node, offset: index - seen }
    }
    seen += length
  }
  return undefined
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
  const block = blockOf(range.commonAncestorContainer)
  if (block === null) {
    return undefined
  }
  const text = block.textContent ?? ""
  const start = offsetIn(block, range.startContainer, range.startOffset)
  const end = offsetIn(block, range.endContainer, range.endOffset)
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
    rectsOf: (match) =>
      (clicked < 0 ? undefined : placeMatch(sentence, match, clicked))?.flatMap(([from, to]) => {
        const startAt = positionIn(block, toRaw(from))
        const endAt = positionIn(block, toRaw(to - 1) + 1)
        if (startAt === undefined || endAt === undefined) {
          return []
        }
        const part = document.createRange()
        part.setStart(startAt.node, startAt.offset)
        part.setEnd(endAt.node, endAt.offset)
        return [...part.getClientRects()]
      }) ?? [],
  }
}
