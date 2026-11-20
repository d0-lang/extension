/** Where in the player the subtitles may be dragged. */

export type Box = { top: number; bottom: number; left: number; right: number }

/** Of the player's height, like the gap under YouTube's own captions. */
const MARGIN_RATIO = 0.02

const shiftAlong = (start: number, end: number, from: number, to: number): number => {
  if (end - start > to - from) {
    return (from + to) / 2 - (start + end) / 2
  }
  if (start < from) {
    return from - start
  }
  return end > to ? to - end : 0
}

/** How far `box` moves to sit in `area`, as little as possible. On an axis it does not fit, it is centred. */
export const shiftInto = (box: Box, area: Box): { x: number; y: number } => ({
  x: shiftAlong(box.left, box.right, area.left, area.right),
  y: shiftAlong(box.top, box.bottom, area.top, area.bottom),
})

/** The player, less its title bar and controls and a margin. Both fade out rather than leave the layout. */
export const safeArea = (player: HTMLElement): Box => {
  const box = player.getBoundingClientRect()
  const margin = box.height * MARGIN_RATIO
  // Players without a title, like the watch page's, keep the bar empty or hidden.
  const title = player.querySelector(".ytp-chrome-top")?.getBoundingClientRect()
  const controls = player.querySelector(".ytp-chrome-bottom")?.getBoundingClientRect()
  return {
    top: (title === undefined || title.height === 0 ? box.top : title.bottom) + margin,
    bottom: (controls === undefined || controls.height === 0 ? box.bottom : controls.top) - margin,
    left: box.left + margin,
    right: box.right - margin,
  }
}
