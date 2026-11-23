// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { watchAltHold } from "./hold"
import type { WordHit } from "./page/pick"

/** Longer than the hold waits for the cursor to settle on a word. */
const SETTLED_MS = 500

/** The parts of the context the hold uses, on fake timers. */
const fakeContext = (signal: AbortSignal) =>
  ({
    signal,
    addEventListener: (
      target: EventTarget,
      type: string,
      listener: (event: Event) => void,
      options?: AddEventListenerOptions,
    ) => target.addEventListener(type, listener as EventListener, { ...options, signal }),
    setTimeout: (handler: () => void, ms: number) => window.setTimeout(handler, ms),
    requestAnimationFrame: (callback: () => void) => window.setTimeout(callback, 16),
  }) as unknown as ContentScriptContext

/** A hit on `word` at the start of `node`, drawn at `left`. */
const hitOn = (node: Text, word: string, left: number): WordHit => {
  const range = document.createRange()
  range.setStart(node, 0)
  range.setEnd(node, word.length)
  return { word, anchor: { top: 10, bottom: 30, left, right: left + 40 }, element: node.parentElement, range }
}

const pressAlt = () => window.dispatchEvent(new KeyboardEvent("keydown", { code: "AltLeft" }))

const movePointer = (x: number) => {
  window.dispatchEvent(new MouseEvent("pointermove", { clientX: x, clientY: 20 }))
  vi.advanceTimersByTime(SETTLED_MS)
}

describe("watchAltHold", () => {
  let aborts: AbortController
  let show: ReturnType<typeof vi.fn<(hit: WordHit) => void>>

  let close: ReturnType<typeof vi.fn<() => void>>

  /** Hold with the cursor on whatever `hits` returns for each move, in turn. */
  const hold = (hits: Array<WordHit>) => {
    const queue = [...hits]
    watchAltHold(fakeContext(aborts.signal), {
      isEnabled: () => true,
      wordAt: () => queue.shift(),
      isOverPopover: () => false,
      popoverScroller: () => undefined,
      show,
      close,
    })
    movePointer(0)
    pressAlt()
  }

  beforeEach(() => {
    vi.useFakeTimers()
    aborts = new AbortController()
    show = vi.fn<(hit: WordHit) => void>()
    close = vi.fn<() => void>()
    // happy-dom lays nothing out, so a range is drawn while its text is in the page and not hidden.
    vi.spyOn(Range.prototype, "getClientRects").mockImplementation(function (this: Range) {
      const shown = this.startContainer.isConnected && this.startContainer.parentElement?.hidden === false
      return (shown ? [new DOMRect()] : []) as unknown as DOMRectList
    })
    document.body.innerHTML = `<p>Kaiser</p><p>Kaiser</p>`
  })

  afterEach(() => {
    aborts.abort()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const texts = () => [...document.querySelectorAll("p")].map((paragraph) => paragraph.firstChild as Text)

  it("does not look a word up again when the text moves under a still cursor", () => {
    const [first] = texts()
    hold([hitOn(first!, "Kaiser", 10), hitOn(first!, "Kaiser", 14), hitOn(first!, "Kaiser", 18)])
    movePointer(1)
    movePointer(2)
    expect(show).toHaveBeenCalledTimes(1)
  })

  it("looks up the same word again in another text node, even at the same place", () => {
    const [first, second] = texts()
    // Where on screen is the same, as when the page puts new text in the old one's place.
    hold([hitOn(first!, "Kaiser", 10), hitOn(second!, "Kaiser", 10)])
    movePointer(1)
    expect(show).toHaveBeenCalledTimes(2)
    expect(show.mock.calls[1]![0].range.startContainer).toBe(second)
  })

  it("closes when the shown word leaves the screen and no word is under the cursor", () => {
    const [first] = texts()
    hold([hitOn(first!, "Kaiser", 10)])
    first!.parentElement!.hidden = true
    vi.advanceTimersByTime(SETTLED_MS)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it("shows the word under the cursor when the shown word's text is replaced", () => {
    const [first, second] = texts()
    hold([hitOn(first!, "Kaiser", 10), hitOn(second!, "Kaiser", 10)])
    first!.remove()
    vi.advanceTimersByTime(SETTLED_MS)
    expect(close).not.toHaveBeenCalled()
    expect(show.mock.calls[1]![0].range.startContainer).toBe(second)
  })
})
