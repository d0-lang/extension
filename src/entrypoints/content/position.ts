import type { AnchorRect } from "./pick"

const GAP_PX = 6
const MARGIN_PX = 8
const MAX_HEIGHT_PX = 360
/** Share of the viewport height the popover may take, so a small screen keeps more of the page in view. */
const MAX_HEIGHT_SHARE = 0.5
/** Below this much room on its side, the popover covers the word rather than shrinking further. */
const MIN_ROOM_PX = 120

export type Side = "below" | "above"

type Size = { width: number; height: number }

const clamp = (value: number, size: number, viewport: number): number =>
  Math.max(MARGIN_PX, Math.min(value, viewport - size - MARGIN_PX))

/** Height the popover can take on `side` of the anchor without leaving the viewport. */
export const roomOn = (side: Side, anchor: AnchorRect, viewport: Size): number =>
  side === "below"
    ? viewport.height - anchor.bottom - GAP_PX - MARGIN_PX
    : anchor.top - GAP_PX - MARGIN_PX

const heightCap = (viewport: Size): number => Math.min(MAX_HEIGHT_PX, viewport.height * MAX_HEIGHT_SHARE)

const pickSide = (anchor: AnchorRect, size: Size, viewport: Size): Side => {
  const roomBelow = roomOn("below", anchor, viewport)
  return Math.min(size.height, heightCap(viewport)) <= roomBelow || roomBelow >= roomOn("above", anchor, viewport)
    ? "below"
    : "above"
}

/**
 * Below the anchor if it fits, otherwise on the roomier side, always inside the viewport.
 * `size.height` is the height the content wants. `maxHeight` keeps the popover off the anchor, so the rest scrolls.
 * A `side` keeps the popover there, so its edge next to the anchor stays put while it changes size.
 */
export const placePopover = (
  anchor: AnchorRect,
  size: Size,
  viewport: Size,
  side: Side = pickSide(anchor, size, viewport),
): { top: number; left: number; side: Side; maxHeight: number } => {
  const maxHeight = Math.min(heightCap(viewport), Math.max(roomOn(side, anchor, viewport), MIN_ROOM_PX))
  const height = Math.min(size.height, maxHeight)
  const top = side === "below" ? anchor.bottom + GAP_PX : anchor.top - GAP_PX - height
  return {
    top: clamp(top, height, viewport.height),
    left: clamp(anchor.left, size.width, viewport.width),
    side,
    maxHeight,
  }
}
