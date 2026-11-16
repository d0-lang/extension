/** What the user right-clicked: read on `contextmenu`, because the page may change before the menu item is pressed. */
import { sentenceAround, type Sentence } from "./sentence"
import { indexIn, joinedInWord, rangeIn, runAround, textRects } from "./text"
import { tokensAt } from "./tokenize"

export type AnchorRect = { top: number; bottom: number; left: number; right: number }

export type Picked = {
  selected: string
  underCursor: string
  anchor: AnchorRect
  /** Where the surrounding text for language detection comes from. */
  element: Element | null
  /** Covers `underCursor`, to mark it on the page. */
  range: Range | undefined
  /** The sentence around whichever of `selected` and `underCursor` is set. */
  context: Sentence | undefined
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

const isOnRange = (range: Range, x: number, y: number): boolean =>
  textRects(range).some(
    (rect) =>
      x >= rect.left - HIT_SLOP_PX &&
      x <= rect.right + HIT_SLOP_PX &&
      y >= rect.top - HIT_SLOP_PX &&
      y <= rect.bottom + HIT_SLOP_PX,
  )

/**
 * The word under the cursor, read across the inline elements it may be cut into.
 * The caret snaps to the nearest text, so a word only counts if the click is really on it.
 */
const tokenUnderCursor = (
  x: number,
  y: number,
  locale: string | undefined,
): { word: string; range: Range } | undefined => {
  const caret = caretAt(x, y)
  if (caret === undefined || !(caret.node instanceof Text)) {
    return undefined
  }
  // Only what the page shows as one word, unlike the sentence, which reads the block's text as markup joins it.
  const run = runAround(caret.node, MAX_WORD_CHARS, joinedInWord)
  return tokensAt(run.text, indexIn(run, caret.node, caret.offset), locale)
    .flatMap(({ start, end }) => {
      const range = rangeIn(run, start, end)
      // Not `range.toString()`, which would take in ruby readings.
      return range === undefined ? [] : [{ word: run.text.slice(start, end), range }]
    })
    .find(({ range }) => isOnRange(range, x, y))
}

/** The box around the text in `range`. Not `range.getBoundingClientRect()`, which takes in ruby readings and padding. */
const textBox = (range: Range): AnchorRect => {
  const rects = textRects(range).filter(({ width }) => width > 0)
  if (rects.length === 0) {
    return range.getBoundingClientRect()
  }
  return {
    top: Math.min(...rects.map(({ top }) => top)),
    bottom: Math.max(...rects.map(({ bottom }) => bottom)),
    left: Math.min(...rects.map(({ left }) => left)),
    right: Math.max(...rects.map(({ right }) => right)),
  }
}

/** `range` covers `word`, for reading the sentence around it once the word is shown. */
export type WordHit = { word: string; anchor: AnchorRect; element: Element | null; range: Range }

/** The word under the cursor, ignoring any selection. */
export const wordAt = (x: number, y: number, locale: string | undefined): WordHit | undefined => {
  const token = tokenUnderCursor(x, y, locale)
  return token === undefined
    ? undefined
    : {
        word: token.word,
        anchor: textBox(token.range),
        element: token.range.startContainer.parentElement,
        range: token.range,
      }
}

const hasArea = ({ width, height }: DOMRect): boolean => width > 0 || height > 0

/** Record the selection and the word under the cursor, plus the box to open next to. */
export const pickAt = (x: number, y: number, target: Element | null, locale: string | undefined): Picked => {
  const point: AnchorRect = { top: y, bottom: y, left: x, right: x }
  const selection = window.getSelection()
  const selected = selection?.toString().trim() ?? ""
  if (selection !== null && selected !== "" && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const ancestor = range.commonAncestorContainer
    return {
      selected,
      underCursor: "",
      anchor: hasArea(rect) ? rect : point,
      element: ancestor instanceof Element ? ancestor : ancestor.parentElement,
      range: undefined,
      context: sentenceAround(range, selected, locale),
    }
  }
  const hit = wordAt(x, y, locale)
  return {
    selected: "",
    underCursor: hit?.word ?? "",
    anchor: hit?.anchor ?? point,
    element: target,
    range: hit?.range,
    context: hit === undefined ? undefined : sentenceAround(hit.range, hit.word, locale),
  }
}

/** The DOM selection misses text selected inside inputs, which the menu's own selection text covers. */
export const pickedWord = (picked: Picked | undefined, selectionText: string | undefined): string =>
  picked?.selected || selectionText?.trim() || picked?.underCursor || ""

/** Whether the looked-up word is the one under the cursor, rather than a selection. */
export const pickedUnderCursor = (picked: Picked | undefined, selectionText: string | undefined): boolean =>
  picked !== undefined &&
  picked.underCursor !== "" &&
  pickedWord(picked, selectionText) === picked.underCursor &&
  !selectionText?.trim()

/** The picked sentence, unless the menu's own selection text replaced the picked word. */
export const pickedContext = (picked: Picked | undefined, word: string): Sentence | undefined =>
  picked !== undefined && word !== "" && (word === picked.selected || word === picked.underCursor)
    ? picked.context
    : undefined
