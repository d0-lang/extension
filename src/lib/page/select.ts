import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { isTyping } from "./hold"
import { createLookUpButton } from "./look-up-button"
import { MAX_WORD_CHARS, type AnchorRect, type Selected } from "./pick"

/** Dragging a handle to widen the selection changes it many times, and the button waits for where it stops. */
const SETTLE_MS = 300

/** Room under a selection for the handles a phone draws below it, which the button and popover would cover. */
const HANDLES_PX = 28

/** Room above a selection for the bar of Copy, Share and the like that Android shows over it. */
const TOOLBAR_PX = 56

type SelectOptions = {
  isEnabled: () => boolean
  /** Whether `event` happened on the popover, whose text is not looked up from. */
  isOnPopover: (event: Event) => boolean
  selected: () => Selected | undefined
  /** `anchor` is the selection's box with the handles under it and Android's bar above it. */
  show: (selected: Selected, anchor: AnchorRect) => void
}

/** Whether `a` and `b` cover the same text at the same place, so a selection that did not move is not offered again. */
const sameSelection = (a: Selected | undefined, b: Selected): boolean =>
  a !== undefined &&
  a.word === b.word &&
  a.range.startContainer === b.range.startContainer &&
  a.range.startOffset === b.range.startOffset

/**
 * Offers to look up a word selected by touch, like with a long press on a phone, where there is no Alt to hold or menu
 * to open. A "Look up" button shows under the selection once it settles, and goes while it changes. A selection longer
 * than a word or two, or one made with a mouse or keys, gets no button.
 */
export const watchTouchSelection = (
  ctx: ContentScriptContext,
  { isEnabled, isOnPopover, selected, show }: SelectOptions,
) => {
  let touching = false
  let timer: number | undefined
  /** The selection the button is for. */
  let offered: { selected: Selected; anchor: AnchorRect } | undefined
  /** The selection last looked up, which the popover is open for. */
  let shown: Selected | undefined
  const button = createLookUpButton(ctx, () => {
    if (offered !== undefined) {
      shown = offered.selected
      show(offered.selected, offered.anchor)
    }
  })

  const offer = () => {
    const now = selected()
    offered = undefined
    if (
      !touching ||
      !isEnabled() ||
      isTyping() ||
      now === undefined ||
      now.word.length > MAX_WORD_CHARS ||
      sameSelection(shown, now)
    ) {
      return
    }
    const { top, bottom, left, right } = now.anchor
    offered = { selected: now, anchor: { top: top - TOOLBAR_PX, bottom: bottom + HANDLES_PX, left, right } }
    button.show(offered.anchor)
  }

  ctx.addEventListener(
    window,
    "pointerdown",
    (event) => {
      touching = event.pointerType === "touch" && !isOnPopover(event)
    },
    { capture: true, passive: true },
  )
  ctx.addEventListener(document, "selectionchange", () => {
    button.hide()
    clearTimeout(timer)
    timer = ctx.setTimeout(offer, SETTLE_MS)
  })
}
