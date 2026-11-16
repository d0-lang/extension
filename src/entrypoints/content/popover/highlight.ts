import type { MarkStyle } from "$lib/storage"

/**
 * Mark `ranges` on the page in `style`, until the returned function is called.
 * The browser paints the mark with the text, so it follows scrolling, clipping and reflow.
 * `dark` is the page behind the words, which picks the colour that shows up there.
 */
export const highlightRanges = (
  ranges: ReadonlyArray<Range>,
  style: MarkStyle,
  dark: boolean,
): (() => void) => {
  // The registry is the page's too, so the names are ours alone and nothing else in it is touched.
  const name = `dadict-${style}${dark ? "-dark" : ""}`
  const highlight = new Highlight(...ranges)
  CSS.highlights.set(name, highlight)
  return () => {
    if (CSS.highlights.get(name) === highlight) {
      CSS.highlights.delete(name)
    }
  }
}
