/** Where the clicked word and the server's `match` sit in the sentence sent as `context`. */

/** `raw` with whitespace runs as one space and trimmed, and where each kept character was in `raw`. */
export const collapseWhitespace = (raw: string): { text: string; rawIndex: Array<number> } => {
  let text = ""
  const rawIndex: Array<number> = []
  let space = -1
  for (let i = 0; i < raw.length; i++) {
    if (/\s/.test(raw[i]!)) {
      space = space < 0 ? i : space
      continue
    }
    if (space >= 0 && text !== "") {
      text += " "
      rawIndex.push(space)
    }
    space = -1
    text += raw[i]
    rawIndex.push(i)
  }
  return { text, rawIndex }
}

/**
 * The protocol's `at` for the copy of `word` that starts at `start` in `text`:
 * copies counted from 1, left to right, without overlap. Unset when no copy starts there.
 */
export const copyNumber = (text: string, word: string, start: number): number | undefined => {
  if (word === "") {
    return undefined
  }
  let count = 0
  for (
    let index = text.indexOf(word);
    index >= 0 && index <= start;
    index = text.indexOf(word, index + word.length)
  ) {
    count++
    if (index === start) {
      return count
    }
  }
  return undefined
}

const positionsOf = (text: string, part: string): Array<number> => {
  const found: Array<number> = []
  for (let index = text.indexOf(part); index >= 0; index = text.indexOf(part, index + 1)) {
    found.push(index)
  }
  return found
}

/**
 * Spans `[start, end)` of `match` in `text`, in order and apart, with one covering `clicked`.
 * A part may occur more than once, so the one at the click anchors the rest. Unset when they don't fit.
 */
export const placeMatch = (
  text: string,
  match: ReadonlyArray<string>,
  clicked: number,
): Array<[number, number]> | undefined => {
  for (let anchor = 0; anchor < match.length; anchor++) {
    const part = match[anchor]!
    for (const start of positionsOf(text, part)) {
      if (start > clicked || start + part.length <= clicked) {
        continue
      }
      const spans: Array<[number, number]> = [[start, start + part.length]]
      let ok = true
      // Parts after the anchor: the nearest copy after the one before.
      for (let i = anchor + 1; i < match.length && ok; i++) {
        const next = text.indexOf(match[i]!, spans.at(-1)![1])
        ok = next >= 0
        spans.push([next, next + match[i]!.length])
      }
      // Parts before it: the nearest copy that ends before the one after.
      for (let i = anchor - 1; i >= 0 && ok; i--) {
        const limit = spans[0]![0] - match[i]!.length
        const previous = limit < 0 ? -1 : text.lastIndexOf(match[i]!, limit)
        ok = previous >= 0
        spans.unshift([previous, previous + match[i]!.length])
      }
      if (ok) {
        return spans
      }
    }
  }
  return undefined
}

/**
 * Where a clause starts: after `,` `;` `:` and the spaces after them (so `2,5` stays whole), after the
 * full-width marks of Chinese and Japanese (`，` `、` `；` `：`) and the Arabic comma and semicolon
 * (`،` `؛`), or at a spaced dash.
 */
const CLAUSE_START = /[,;:]\s+|[，、；：،؛]\s*|\s+(?=[—–]\s)/gu

/** `max` characters around `[start, end)`, the word in the middle where the text allows, not splitting a surrogate pair. */
const charactersAround = (text: string, start: number, end: number, max: number): [number, number] => {
  const to = Math.min(text.length, Math.max(0, start - Math.floor((max - (end - start)) / 2)) + max)
  const from = Math.max(0, to - max)
  const lowSurrogate = (at: number) => at > 0 && at < text.length && /[\uDC00-\uDFFF]/u.test(text[at]!)
  return [lowSurrogate(from) ? from + 1 : from, lowSurrogate(to) ? to - 1 : to]
}

/** `[from, to)` grown by one piece at a time, right then left, while it stays within `max`. */
const expand = (
  [from, to]: [number, number],
  max: number,
  right: (to: number) => number | undefined,
  left: (from: number) => number | undefined,
  length: (from: number, to: number) => number,
): [number, number] => {
  let span: [number, number] = [from, to]
  for (let grew = true; grew;) {
    grew = false
    const next = right(span[1])
    if (next !== undefined && length(span[0], next) <= max) {
      span = [span[0], next]
      grew = true
    }
    const previous = left(span[0])
    if (previous !== undefined && length(previous, span[1]) <= max) {
      span = [previous, span[1]]
      grew = true
    }
  }
  return span
}

/**
 * The part `[from, to)` of a sentence too long to send, around the word at `[start, end)`: the clause
 * holding it (`CLAUSE_START`), with whole clauses on either side while it stays within `max`, or else
 * the words around it, or in text without spaces the characters around it. Never longer than `max`.
 * Trailing spaces are left out. Unset when the word is longer.
 */
export const excerptAround = (
  text: string,
  start: number,
  end: number,
  max: number,
): [number, number] | undefined => {
  const length = (from: number, to: number) => text.slice(from, to).trimEnd().length
  const trimmed = ([from, to]: [number, number]): [number, number] => [from, from + length(from, to)]
  if (text.length <= max) {
    return [0, text.length]
  }
  if (end - start > max) {
    return undefined
  }
  const starts = [0, ...[...text.matchAll(CLAUSE_START)].map((found) => found.index + found[0].length)]
  const ends = [...starts.slice(1), text.length]
  const first = starts.findLastIndex((at) => at <= start)
  const last = ends.findIndex((at) => at >= end)
  const clause: [number, number] = [starts[first]!, ends[last]!]
  if (length(...clause) <= max) {
    return trimmed(
      expand(
        clause,
        max,
        (to) => ends.find((at) => at > to),
        (from) => starts.findLast((at) => at < from),
        length,
      ),
    )
  }
  // A clause too long on its own: the words around the word.
  const spaces = [...text.matchAll(/\s+/gu)]
  const wordStarts = [0, ...spaces.map((found) => found.index + found[0].length)]
  const wordEnds = [...spaces.map((found) => found.index), text.length]
  const words = trimmed(
    expand(
      [wordStarts.findLast((at) => at <= start)!, wordEnds.find((at) => at >= end)!],
      max,
      (to) => wordEnds.find((at) => at > to),
      (from) => wordStarts.findLast((at) => at < from),
      length,
    ),
  )
  // Without spaces around the word (Chinese, Japanese), its neighbours are one long "word".
  return length(...words) <= max ? words : charactersAround(text, start, end, max)
}
