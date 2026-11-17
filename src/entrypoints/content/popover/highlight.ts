import type { MarkStyle } from "$lib/storage"

/** Marks `ranges` in `style` until the returned function is called. `dark` is the page behind them. */
export type Paint = (ranges: ReadonlyArray<Range>, style: MarkStyle, dark: boolean) => () => void

/**
 * Marks with the CSS Custom Highlight API, for text on the page.
 * The browser paints the mark with the text, so it follows scrolling, clipping and reflow.
 * `dark` picks the colour that shows up there.
 */
export const highlightRanges: Paint = (ranges, style, dark) => {
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
