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
  for (let index = text.indexOf(word); index >= 0 && index <= start; index = text.indexOf(word, index + word.length)) {
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
