import type { ContentScriptContext } from "wxt/utils/content-script-context"
import type { AnchorRect } from "./pick"

const GAP_PX = 4
const MARGIN_PX = 8

/** Kept from the page, which would take them as its own, like a tap that closes its menu. */
const SWALLOWED = ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "touchstart", "touchend"]

/** Inside a shadow root, so the page's styles cannot reach it. */
const CSS = `
button {
  all: initial;
  display: block;
  padding: 8px 14px;
  border-radius: 999px;
  background: #1c1c1c;
  color: #fff;
  font: 500 14px/1 system-ui, sans-serif;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.3);
  cursor: pointer;
}
`

/**
 * A small "Look up" button under a touch selection, in the page so it scrolls with the text. Pressing it hides it and
 * calls `onPress`. The press keeps the selection, so the looked-up words stay marked.
 */
export const createLookUpButton = (ctx: ContentScriptContext, onPress: () => void) => {
  let host: HTMLElement | undefined

  const hide = () => {
    host?.remove()
    host = undefined
  }

  /** Shows the button centred under `anchor`, inside the viewport. */
  const show = (anchor: AnchorRect) => {
    hide()
    host = document.createElement("dadict-look-up")
    host.style.cssText = "all: initial; position: absolute; z-index: 2147483647"
    const shadow = host.attachShadow({ mode: "open" })
    const style = document.createElement("style")
    style.textContent = CSS
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = "Look up"
    shadow.append(style, button)
    for (const type of SWALLOWED) {
      host.addEventListener(type, (event) => event.stopPropagation())
    }
    // A press on something that is not text would end the selection.
    host.addEventListener("pointerdown", (event) => event.preventDefault())
    host.addEventListener("mousedown", (event) => event.preventDefault())
    button.addEventListener("click", () => {
      hide()
      onPress()
    })
    document.documentElement.append(host)
    const width = host.offsetWidth
    const centre = (anchor.left + anchor.right) / 2
    const left = Math.max(MARGIN_PX, Math.min(centre - width / 2, window.innerWidth - width - MARGIN_PX))
    host.style.left = `${left + window.scrollX}px`
    host.style.top = `${anchor.bottom + GAP_PX + window.scrollY}px`
  }

  ctx.onInvalidated(hide)
  return { show, hide }
}
