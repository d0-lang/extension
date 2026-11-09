import type { AnchorRect } from "../page/pick"
import { textRects } from "../page/text"

/** Boxes side by side whose heights overlap by at least this much of the shorter one are on one line. */
const SAME_LINE = 0.5

const overlap = (a: AnchorRect, b: AnchorRect): number =>
  Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)

const isSameLine = (a: AnchorRect, b: AnchorRect): boolean =>
  overlap(a, b) >= SAME_LINE * Math.min(a.bottom - a.top, b.bottom - b.top)

/**
 * One box per line, from the boxes of a word's text.
 * A word cut into spans has a box per span, and letters lifted or shrunk by effects have their own heights.
 */
export const lineBoxes = (rects: ReadonlyArray<AnchorRect>): Array<AnchorRect> =>
  rects
    .filter((rect) => rect.right > rect.left)
    .reduce<Array<AnchorRect>>((lines, rect) => {
      const index = lines.findIndex((line) => isSameLine(line, rect))
      const line = lines[index]
      if (line === undefined) {
        return [...lines, { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right }]
      }
      return lines.with(index, {
        top: Math.min(line.top, rect.top),
        bottom: Math.max(line.bottom, rect.bottom),
        left: Math.min(line.left, rect.left),
        right: Math.max(line.right, rect.right),
      })
    }, [])

export const sameBoxes = (a: ReadonlyArray<AnchorRect>, b: ReadonlyArray<AnchorRect>): boolean =>
  a.length === b.length &&
  a.every(
    (rect, index) =>
      rect.top === b[index]!.top &&
      rect.bottom === b[index]!.bottom &&
      rect.left === b[index]!.left &&
      rect.right === b[index]!.right,
  )

/** Ancestors that cut off what overflows them, like a scroll box. Read once per range, as styles rarely change. */
export const clippingAncestors = (node: Node): Array<Element> => {
  const found: Array<Element> = []
  const root = node.ownerDocument
  for (let element = node.parentElement; element !== null; element = element.parentElement) {
    if (element === root?.body || element === root?.documentElement) {
      break
    }
    const { display, overflowX, overflowY } = getComputedStyle(element)
    // Overflow does nothing on an inline element, whose client box is empty.
    if (
      display !== "inline" &&
      display !== "contents" &&
      (overflowX !== "visible" || overflowY !== "visible")
    ) {
      found.push(element)
    }
  }
  return found
}

/** The part of `element` its content shows in, without borders and scrollbars. */
export const contentBox = (element: Element): AnchorRect => {
  const rect = element.getBoundingClientRect()
  const left = rect.left + element.clientLeft
  const top = rect.top + element.clientTop
  return { left, top, right: left + element.clientWidth, bottom: top + element.clientHeight }
}

/**
 * `line` cut to the sides of `box`. Unset when its bottom, where the underline goes, is outside the box,
 * so a word scrolled out of a box loses its underline instead of keeping one at the box's edge.
 */
export const clipLine = (line: AnchorRect, box: AnchorRect): AnchorRect | undefined => {
  const left = Math.max(line.left, box.left)
  const right = Math.min(line.right, box.right)
  return line.bottom <= box.top || line.bottom > box.bottom || right <= left
    ? undefined
    : { ...line, left, right }
}

/**
 * Call `show` with the underline boxes of `ranges` now and whenever they move, until the returned function is called.
 * Measured every frame, because text can move without any event: a banner pushes it down, a box scrolls,
 * or an effect resizes letters. The ranges follow the text, and an underline goes once its text leaves the page.
 */
export const trackUnderlines = (
  ranges: ReadonlyArray<Range>,
  show: (lines: Array<AnchorRect>) => void,
): (() => void) => {
  const tracked = ranges.map((range) => ({ range, clips: clippingAncestors(range.commonAncestorContainer) }))
  let shown: Array<AnchorRect> | undefined
  let frame = 0
  const measure = () => {
    const next = tracked.flatMap(({ range, clips }) => {
      const boxes = clips.map(contentBox)
      return lineBoxes(textRects(range)).flatMap(
        (line) =>
          boxes.reduce<AnchorRect | undefined>((kept, box) => kept && clipLine(kept, box), line) ?? [],
      )
    })
    if (shown === undefined || !sameBoxes(next, shown)) {
      shown = next
      show(next)
    }
    frame = requestAnimationFrame(measure)
  }
  measure()
  return () => cancelAnimationFrame(frame)
}
