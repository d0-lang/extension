import type { AnchorRect } from "./pick"

const GAP_PX = 6
const MARGIN_PX = 8

export type Side = "below" | "above"

type Size = { width: number; height: number }

const clamp = (value: number, size: number, viewport: number): number =>
  Math.max(MARGIN_PX, Math.min(value, viewport - size - MARGIN_PX))

/** Height the popover can take on `side` of the anchor without leaving the viewport. */
export const roomOn = (side: Side, anchor: AnchorRect, viewport: Size): number =>
  side === "below"
    ? viewport.height - anchor.bottom - GAP_PX - MARGIN_PX
    : anchor.top - GAP_PX - MARGIN_PX

const pickSide = (anchor: AnchorRect, size: Size, viewport: Size): Side => {
  const roomBelow = roomOn("below", anchor, viewport)
  return size.height <= roomBelow || roomBelow >= roomOn("above", anchor, viewport) ? "below" : "above"
}

/**
 * Below the anchor if it fits, otherwise on the roomier side, always inside the viewport.
 * A `side` keeps the popover there, so its edge next to the anchor stays put while it changes size.
 */
export const placePopover = (
  anchor: AnchorRect,
  size: Size,
  viewport: Size,
  side: Side = pickSide(anchor, size, viewport),
): { top: number; left: number; side: Side; room: number } => {
  const top = side === "below" ? anchor.bottom + GAP_PX : anchor.top - GAP_PX - size.height
  return {
    top: clamp(top, size.height, viewport.height),
    left: clamp(anchor.left, size.width, viewport.width),
    side,
    room: roomOn(side, anchor, viewport),
  }
}
