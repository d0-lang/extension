import { fromThrowable } from "neverthrow"

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

/**
 * The sentence or subtitle line around `range`, with whitespace collapsed.
 * Unset when it is too long, or when it does not contain `word` as picked.
 */
export const sentenceAround = (
  range: Range,
  word: string,
  locale: string | undefined,
): string | undefined => {
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
  const sentence = text
    .slice(first.index, last.index + last.segment.length)
    .replace(/\s+/g, " ")
    .trim()
  return sentence.length <= MAX_SENTENCE_CHARS && sentence.includes(word.replace(/\s+/g, " "))
    ? sentence
    : undefined
}
