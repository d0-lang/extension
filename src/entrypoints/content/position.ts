import type { AnchorRect } from "./pick"

const GAP_PX = 6
const MARGIN_PX = 8

const clamp = (value: number, size: number, viewport: number): number =>
  Math.max(MARGIN_PX, Math.min(value, viewport - size - MARGIN_PX))

/** Below the anchor if it fits, otherwise on the roomier side, always inside the viewport. */
export const placePopover = (
  anchor: AnchorRect,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } => {
  const roomBelow = viewport.height - anchor.bottom - GAP_PX - MARGIN_PX
  const roomAbove = anchor.top - GAP_PX - MARGIN_PX
  const top =
    size.height <= roomBelow || roomBelow >= roomAbove
      ? anchor.bottom + GAP_PX
      : anchor.top - GAP_PX - size.height
  return {
    top: clamp(top, size.height, viewport.height),
    left: clamp(anchor.left, size.width, viewport.width),
  }
}
