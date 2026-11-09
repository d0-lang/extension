/** The page's text as it reads, joined across the inline elements a word can be cut into, like letters lit up in synced lyrics. */

/** `inline-block` too, because per-letter effects need it for transforms. */
const INLINE_DISPLAYS = new Set([
  "inline",
  "contents",
  "inline-block",
  "ruby",
  "ruby-base",
  "ruby-base-container",
])

/** Ruby readings sit above the line, and the rest never renders. */
const SKIPPED_TAGS = new Set(["RT", "RP", "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"])

type Role = "inline" | "skip" | "break"

const roleOf = (element: Element): Role => {
  if (SKIPPED_TAGS.has(element.tagName)) {
    return "skip"
  }
  if (element.tagName === "BR") {
    return "break"
  }
  const display = getComputedStyle(element).display
  return display === "none" ? "skip" : INLINE_DISPLAYS.has(display) ? "inline" : "break"
}

/** The nearest ancestor that is not inline, like a paragraph or a subtitle line. */
const blockOf = (node: Node): Element | null => {
  const element = node instanceof Element ? node : node.parentElement
  return element === null || roleOf(element) !== "inline" || element.parentElement === null
    ? element
    : blockOf(element.parentElement)
}

/** Text read from one block, and where each text node's part starts in it. */
export type TextRun = { text: string; nodes: Array<{ node: Text; start: number }> }

/** Spaces do not count towards a reach, so indented markup does not cut a run short. */
const countedLength = (text: string): number => text.replace(/\s+/g, "").length

/**
 * The unbroken text around `node` inside its block, reaching at least `reach` characters, not counting spaces, each way.
 * It stops early at a nested block or a line break, and where `joins` says two text nodes in a row do not.
 */
export const runAround = (
  node: Text,
  reach: number,
  joins: (before: Text, after: Text) => boolean = () => true,
): TextRun => {
  const block = blockOf(node) ?? node.ownerDocument.documentElement
  const roles = new Map<Element, Role>()
  const cachedRole = (element: Element): Role => {
    const role = roles.get(element) ?? roleOf(element)
    roles.set(element, role)
    return role
  }
  const walker = node.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (candidate) => {
      if (!(candidate instanceof Element)) {
        return NodeFilter.FILTER_ACCEPT
      }
      const role = cachedRole(candidate)
      return role === "skip"
        ? NodeFilter.FILTER_REJECT
        : role === "inline"
          ? NodeFilter.FILTER_SKIP
          : NodeFilter.FILTER_ACCEPT
    },
  })
  // Walking back reaches a nested block's text before the block itself.
  const insideBreak = (text: Node): boolean => {
    for (
      let element = text.parentElement;
      element !== null && element !== block;
      element = element.parentElement
    ) {
      if (cachedRole(element) === "break") {
        return true
      }
    }
    return false
  }
  /** `joined` gets the last text taken and the next one, in the order of the walk. */
  const collect = (step: () => Node | null, joined: (last: Text, next: Text) => boolean): Array<Text> => {
    const found: Array<Text> = []
    let counted = 0
    let last = node
    for (
      let next = step();
      next instanceof Text &&
      counted < reach &&
      !insideBreak(next) &&
      (next.data === "" || joined(last, next));
      next = step()
    ) {
      found.push(next)
      counted += countedLength(next.data)
      // An empty text node has no box to measure from.
      last = next.data === "" ? last : next
    }
    return found
  }
  walker.currentNode = node
  const before = collect(
    () => walker.previousNode(),
    (last, next) => joins(next, last),
  ).reverse()
  walker.currentNode = node
  const after = collect(() => walker.nextNode(), joins)

  let text = ""
  const nodes: TextRun["nodes"] = []
  for (const part of [...before, node, ...after]) {
    nodes.push({ node: part, start: text.length })
    text += part.data
  }
  return { text, nodes }
}

/** Where a DOM position is in the run's text. A position past the run's last text node is its end. */
export const indexIn = (run: TextRun, node: Node, offset: number): number => {
  const found = run.nodes.find((part) => part.node === node)
  if (found !== undefined) {
    return found.start + offset
  }
  // A selection can start or end between elements instead of inside a text node.
  const boundary = (node.ownerDocument ?? document).createRange()
  boundary.setStart(node, offset)
  const next = run.nodes.find((part) => boundary.comparePoint(part.node, 0) >= 0)
  return next?.start ?? run.text.length
}

/** The first text node `range` covers any of. */
export const firstText = (range: Range): Text | undefined => {
  const root = range.commonAncestorContainer
  if (root instanceof Text) {
    return root
  }
  const walker = root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let next = walker.nextNode(); next !== null; next = walker.nextNode()) {
    if (
      next instanceof Text &&
      range.intersectsNode(next) &&
      !(next === range.endContainer && range.endOffset === 0)
    ) {
      return next
    }
  }
  return undefined
}

/**
 * A DOM position for `index` of the run. Where two text nodes meet, a start goes at the beginning of the later one
 * and an end at the close of the earlier one, so a range does not reach into the end of a line before a wrap.
 */
const positionIn = (
  run: TextRun,
  index: number,
  side: "start" | "end",
): { node: Text; offset: number } | undefined => {
  const found = run.nodes.find(({ node, start }) =>
    side === "start" ? index < start + node.data.length : index <= start + node.data.length,
  )
  return found === undefined ? undefined : { node: found.node, offset: index - found.start }
}

/** A range over `[start, end)` of the run, which can span several text nodes. */
export const rangeIn = (run: TextRun, start: number, end: number): Range | undefined => {
  const from = positionIn(run, start, "start")
  const to = positionIn(run, end, "end")
  if (from === undefined || to === undefined) {
    return undefined
  }
  const range = from.node.ownerDocument.createRange()
  range.setStart(from.node, from.offset)
  range.setEnd(to.node, to.offset)
  return range
}

/** How far apart two pieces of text may sit on a line and still read as one word. */
const TOUCHING_PX = 1

const charRects = (text: Text, at: number): Array<DOMRect> => {
  const char = text.ownerDocument.createRange()
  char.setStart(text, at)
  char.setEnd(text, at + 1)
  return [...char.getClientRects()]
}

/**
 * Whether the page shows `before` running straight on into `after`, like the pieces of a word cut into spans.
 * Elements side by side in markup can still be drawn apart, by margins, padding or a `::before` separator.
 * A wrap onto another line counts as touching.
 */
// TODO: In a list of tags that wraps, the tag at the end of one line joins the tag at the start of the next.
const touching = (before: Text, after: Text): boolean => {
  if (before.data === "" || after.data === "") {
    return false
  }
  const last = charRects(before, before.data.length - 1).at(-1)
  const first = charRects(after, 0)[0]
  if (last === undefined || first === undefined) {
    return false
  }
  const sameLine = Math.min(last.bottom, first.bottom) > Math.max(last.top, first.top)
  // Either way round, for right-to-left text.
  return (
    !sameLine ||
    Math.abs(first.left - last.right) <= TOUCHING_PX ||
    Math.abs(last.left - first.right) <= TOUCHING_PX
  )
}

const rubyOf = (node: Node): Element | null => node.parentElement?.closest("ruby") ?? null

/**
 * Whether `before` and `after` read as one word: drawn touching, or both in one `<ruby>`.
 * The base of a ruby is pushed apart by readings wider than it, by different amounts in different browsers.
 */
export const joinedInWord = (before: Text, after: Text): boolean => {
  const ruby = rubyOf(before)
  return (ruby !== null && ruby === rubyOf(after)) || touching(before, after)
}

const isSkipped = (node: Node, root: Node): boolean => {
  for (let element = node.parentElement; element !== null; element = element.parentElement) {
    if (SKIPPED_TAGS.has(element.tagName)) {
      return true
    }
    if (element === root) {
      return false
    }
  }
  return false
}

/**
 * Boxes of the text inside `range`, without the boxes of the elements it covers or of ruby readings.
 * Empty once the text is gone from the page.
 */
export const textRects = (range: Range): Array<DOMRect> => {
  const root = range.commonAncestorContainer
  const texts: Array<Text> = []
  if (root instanceof Text) {
    texts.push(root)
  } else {
    const walker = root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let next = walker.nextNode(); next !== null; next = walker.nextNode()) {
      if (next instanceof Text && range.intersectsNode(next) && !isSkipped(next, root)) {
        texts.push(next)
      }
    }
  }
  return texts.flatMap((text) => {
    const part = text.ownerDocument.createRange()
    part.selectNodeContents(text)
    if (text === range.startContainer) {
      part.setStart(text, range.startOffset)
    }
    if (text === range.endContainer) {
      part.setEnd(text, range.endOffset)
    }
    return [...part.getClientRects()]
  })
}
