/** What the user right-clicked: read on `contextmenu`, because the page may change before the menu item is pressed. */

export type AnchorRect = { top: number; bottom: number; left: number; right: number }

export type Picked = {
  selected: string
  underCursor: string
  anchor: AnchorRect
  /** Where the surrounding text for language detection comes from. */
  element: Element | null
}

/** How far a click may land outside the word's box and still count as on it. */
const HIT_SLOP_PX = 2

/** A longer selection is a passage, which should not go to a server as a word. */
export const MAX_WORD_CHARS = 64

const caretAt = (x: number, y: number): { node: Node; offset: number } | undefined => {
  if (document.caretPositionFromPoint !== undefined) {
    const position = document.caretPositionFromPoint(x, y)
    return position === null ? undefined : { node: position.offsetNode, offset: position.offset }
  }
  const range = document.caretRangeFromPoint?.(x, y)
  return range === undefined || range === null
    ? undefined
    : { node: range.startContainer, offset: range.startOffset }
}

/**
 * Word segments around a caret offset, nearest first.
 * A caret in the right half of a letter sits after it, so the word before the caret also counts.
 */
// TODO: Replace with the per-language tokenizers from the protocol.
export const wordSpansAt = (
  text: string,
  offset: number,
): Array<{ start: number; end: number }> => {
  const segments = new Intl.Segmenter(undefined, { granularity: "word" }).segment(text)
  return [offset, offset - 1].flatMap((position) => {
    const segment = segments.containing(position)
    return segment?.isWordLike === true
      ? [{ start: segment.index, end: segment.index + segment.segment.length }]
      : []
  })
}

const isOnRange = (range: Range, x: number, y: number): boolean =>
  [...range.getClientRects()].some(
    (rect) =>
      x >= rect.left - HIT_SLOP_PX &&
      x <= rect.right + HIT_SLOP_PX &&
      y >= rect.top - HIT_SLOP_PX &&
      y <= rect.bottom + HIT_SLOP_PX,
  )

/** The caret snaps to the nearest text, so a span only counts if the click is really on it. */
const rangeUnderCursor = (x: number, y: number): Range | undefined => {
  const caret = caretAt(x, y)
  if (caret === undefined || caret.node.nodeType !== Node.TEXT_NODE) {
    return undefined
  }
  const node = caret.node
  return wordSpansAt(node.textContent ?? "", caret.offset)
    .map(({ start, end }) => {
      const range = document.createRange()
      range.setStart(node, start)
      range.setEnd(node, end)
      return range
    })
    .find((range) => isOnRange(range, x, y))
}

const hasArea = ({ width, height }: DOMRect): boolean => width > 0 || height > 0

/** Record the selection and the word under the cursor, plus the box to open next to. */
export const pickAt = (x: number, y: number, target: Element | null): Picked => {
  const point: AnchorRect = { top: y, bottom: y, left: x, right: x }
  const selection = window.getSelection()
  const selected = selection?.toString().trim() ?? ""
  if (selection !== null && selected !== "" && selection.rangeCount > 0) {
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    const ancestor = selection.getRangeAt(0).commonAncestorContainer
    return {
      selected,
      underCursor: "",
      anchor: hasArea(rect) ? rect : point,
      element: ancestor instanceof Element ? ancestor : ancestor.parentElement,
    }
  }
  const range = rangeUnderCursor(x, y)
  return {
    selected: "",
    underCursor: range?.toString() ?? "",
    anchor: range?.getBoundingClientRect() ?? point,
    element: target,
  }
}

/** The DOM selection misses text selected inside inputs, which the menu's own selection text covers. */
export const pickedWord = (picked: Picked | undefined, selectionText: string | undefined): string =>
  picked?.selected || selectionText?.trim() || picked?.underCursor || ""
