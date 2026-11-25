import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { selectedText, type Selected } from "./pick"
import { watchTouchSelection } from "./select"

/** Longer than a selection takes to settle. */
const SETTLED_MS = 500

const fakeContext = (signal: AbortSignal) =>
  ({
    addEventListener: (
      target: EventTarget,
      type: string,
      listener: (event: Event) => void,
      options?: AddEventListenerOptions,
    ) => target.addEventListener(type, listener as EventListener, { ...options, signal }),
    setTimeout: (handler: () => void, ms: number) => window.setTimeout(handler, ms),
  }) as unknown as ContentScriptContext

const press = (pointerType: string, target: EventTarget = document.body) =>
  target.dispatchEvent(new PointerEvent("pointerdown", { pointerType, bubbles: true, composed: true }))

/** Selects `text` in the paragraph, as a long press or a drag of its handles would. */
const select = (text: string) => {
  const node = document.querySelector("p")!.firstChild as Text
  const start = node.data.indexOf(text)
  window.getSelection()!.setBaseAndExtent(node, start, node, start + text.length)
}

/** Waits for the selection to settle, and for `selectionchange`, which is queued, to come first. */
const settle = () => new Promise((resolve) => setTimeout(resolve, SETTLED_MS))

describe("watchTouchSelection", () => {
  let aborts: AbortController
  let show: ReturnType<typeof vi.fn<(selected: Selected) => void>>
  let onPopover: Element | undefined

  beforeEach(() => {
    document.body.innerHTML = "<p>Ala ma kota, a kot ma Alę.</p><aside>Popover</aside>"
    aborts = new AbortController()
    show = vi.fn()
    onPopover = document.querySelector("aside")!
    watchTouchSelection(fakeContext(aborts.signal), {
      isEnabled: () => true,
      isOnPopover: (event) => event.composedPath().includes(onPopover!),
      selected: () => selectedText("pl"),
      show,
    })
  })

  afterEach(() => {
    aborts.abort()
    window.getSelection()!.removeAllRanges()
    document.body.replaceChildren()
  })

  it("looks up a word selected by touch once the selection settles, with its sentence", async () => {
    press("touch")
    select("kota")
    await settle()
    expect(show).toHaveBeenCalledOnce()
    expect(show.mock.calls[0]![0]).toMatchObject({
      word: "kota",
      context: { text: "Ala ma kota, a kot ma Alę." },
    })
  })

  it("looks up only where a widened selection stops, and not the same one twice", async () => {
    press("touch")
    select("ma")
    select("ma kota")
    await settle()
    select("ma kota")
    await settle()
    expect(show.mock.calls.map(([selected]) => selected.word)).toEqual(["ma kota"])
  })

  it("leaves a selection made with a mouse, one in the popover, or a passage alone", async () => {
    press("mouse")
    select("kota")
    await settle()
    press("touch", onPopover)
    select("ma")
    await settle()
    press("touch")
    document.querySelector("p")!.textContent = "Ala ".repeat(30)
    select("Ala ".repeat(20).trim())
    await settle()
    expect(show).not.toHaveBeenCalled()
  })
})
