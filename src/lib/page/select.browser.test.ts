import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { selectedText, type AnchorRect, type Selected } from "./pick"
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
    onInvalidated: () => {},
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

const button = (): HTMLButtonElement | undefined =>
  document.querySelector("dadict-look-up")?.shadowRoot?.querySelector("button") ?? undefined

/** Waits for the selection to settle and presses the button it offers, if any. */
const pressButton = async () => {
  await settle()
  button()?.click()
}

describe("watchTouchSelection", () => {
  let aborts: AbortController
  let show: ReturnType<typeof vi.fn<(selected: Selected, anchor: AnchorRect) => void>>
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

  it("offers a button under a word selected by touch, which looks it up with its sentence", async () => {
    press("touch")
    select("kota")
    await settle()
    expect(show).not.toHaveBeenCalled()
    const word = document.querySelector("p")!.getBoundingClientRect()
    expect(button()!.getBoundingClientRect().top).toBeGreaterThan(word.top)
    button()!.click()
    expect(show).toHaveBeenCalledOnce()
    expect(show.mock.calls[0]![0]).toMatchObject({
      word: "kota",
      context: { text: "Ala ma kota, a kot ma Alę." },
    })
    const [selected, anchor] = show.mock.calls[0]!
    expect(anchor.top).toBeLessThan(selected.anchor.top)
    expect(anchor.bottom).toBeGreaterThan(selected.anchor.bottom)
    expect(button()).toBeUndefined()
    expect(window.getSelection()!.toString()).toBe("kota")
  })

  it("hides the button while the selection changes, and offers where it stops", async () => {
    press("touch")
    select("ma")
    await settle()
    select("ma kota")
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(button()).toBeUndefined()
    await pressButton()
    expect(show.mock.calls.map(([selected]) => selected.word)).toEqual(["ma kota"])
  })

  it("offers no button for a selection made with a mouse, one in the popover, or a passage", async () => {
    press("mouse")
    select("kota")
    await pressButton()
    press("touch", onPopover)
    select("ma")
    await pressButton()
    press("touch")
    document.querySelector("p")!.textContent = "Ala ".repeat(30)
    select("Ala ".repeat(20).trim())
    await pressButton()
    expect(show).not.toHaveBeenCalled()
  })
})
