import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { isTyping } from "./hold"
import { MAX_WORD_CHARS, type AnchorRect, type Selected } from "./pick"

/** Dragging a handle to widen the selection changes it many times, and only where it stops is looked up. */
const SETTLE_MS = 400

/** Room under a selection for the handles a phone draws below it, which the popover would cover. */
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

/** Whether `a` and `b` cover the same text at the same place, so a selection that did not move is not looked up again. */
const sameSelection = (a: Selected | undefined, b: Selected): boolean =>
  a !== undefined &&
  a.word === b.word &&
  a.range.startContainer === b.range.startContainer &&
  a.range.startOffset === b.range.startOffset

/**
 * Looks up a word selected by touch, like with a long press on a phone, where there is no Alt to hold or menu to
 * open. A selection longer than a word or two, or one made with a mouse or keys, is left alone.
 */
export const watchTouchSelection = (
  ctx: ContentScriptContext,
  { isEnabled, isOnPopover, selected, show }: SelectOptions,
) => {
  let touching = false
  let timer: number | undefined
  let shown: Selected | undefined

  const lookUp = () => {
    const now = selected()
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
    shown = now
    const { top, bottom, left, right } = now.anchor
    show(now, { top: top - TOOLBAR_PX, bottom: bottom + HANDLES_PX, left, right })
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
    clearTimeout(timer)
    timer = ctx.setTimeout(lookUp, SETTLE_MS)
  })
}
