// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest"
import { isUserKeep, listenForKeys } from "./keyboard"

/** Presses `code` on the page, and says whether the page still gets it. */
const press = (code: string, init: KeyboardEventInit = {}): boolean =>
  window.dispatchEvent(new KeyboardEvent("keydown", { code, cancelable: true, ...init }))

/** Presses `code` as the user would. Only the browser marks events as trusted, so here the flag is set by hand. */
const pressReal = (code: string, init: KeyboardEventInit = {}): boolean => {
  const event = new KeyboardEvent("keydown", { code, cancelable: true, ...init })
  Object.defineProperty(event, "isTrusted", { value: true })
  return window.dispatchEvent(event)
}

describe("listenForKeys", () => {
  let stop: () => void

  /** Listens with another part to step to, unless `hasPart` says otherwise. */
  const listen = (hasPart = true) => {
    const stepSegment = vi.fn((_step: 1 | -1) => hasPart)
    stop = listenForKeys({ stepSegment, scroller: () => undefined, play: () => {} })
    return stepSegment
  }

  afterEach(() => stop())

  it("moves between parts on A and D, with Alt held too", () => {
    const stepSegment = listen()
    expect(press("KeyA")).toBe(false)
    expect(press("KeyD", { altKey: true })).toBe(false)
    expect(stepSegment.mock.calls).toEqual([[-1], [1]])
  })

  it("lets A and D reach the page when there is no other part", () => {
    listen(false)
    expect(press("KeyA")).toBe(true)
    expect(press("KeyD", { altKey: true })).toBe(true)
  })

  it("keeps the topmost entry on a real Q, while keeping is on and an entry has the button", () => {
    const scroller = document.createElement("div")
    scroller.innerHTML = `<section><button data-keep></button></section>`
    document.body.append(scroller)
    // No layout here, so the entry gets a box below the scroller's top.
    scroller.querySelector("section")!.getBoundingClientRect = () => new DOMRect(0, 0, 100, 40)
    const button = scroller.querySelector("button")!
    const kept: Array<boolean> = []
    button.addEventListener("click", (event) => kept.push(isUserKeep(event)))

    stop = listenForKeys({ stepSegment: () => false, scroller: () => scroller, play: () => {} })
    expect(pressReal("KeyQ")).toBe(true)
    stop()

    stop = listenForKeys({ stepSegment: () => false, scroller: () => scroller, play: () => {}, keeps: true })
    // A page can make up the key, or click the button, but neither keeps a word.
    expect(press("KeyQ")).toBe(true)
    button.click()
    expect(pressReal("KeyQ")).toBe(false)
    expect(pressReal("KeyQ", { repeat: true })).toBe(false)
    expect(kept).toEqual([false, true])
    scroller.remove()
  })

  it("counts only the one click a real Q makes, not those the page makes while it lands", () => {
    const scroller = document.createElement("div")
    scroller.innerHTML = `<section><button data-keep></button><button data-keep></button></section>`
    document.body.append(scroller)
    scroller.querySelector("section")!.getBoundingClientRect = () => new DOMRect(0, 0, 100, 40)
    const [first, second] = scroller.querySelectorAll("button")
    const kept: Array<string> = []
    first!.addEventListener("click", (event) => kept.push(`first ${isUserKeep(event)}`))
    second!.addEventListener("click", (event) => kept.push(`second ${isUserKeep(event)}`))
    // The page sees Q's click on its way down, and clicks both buttons before the first one's own handler runs.
    const meddle = () => {
      document.removeEventListener("click", meddle, true)
      second!.click()
      first!.click()
    }
    document.addEventListener("click", meddle, true)

    stop = listenForKeys({ stepSegment: () => false, scroller: () => scroller, play: () => {}, keeps: true })
    pressReal("KeyQ")
    // The page's own click on the first button took Q's turn, so Q's click then does not count again.
    expect(kept).toEqual(["second false", "first true", "first false"])
    scroller.remove()
  })

  it("opens the report page on a real B, once per press, and lets B reach the page without a report", () => {
    const report = vi.fn()
    stop = listenForKeys({ stepSegment: () => false, scroller: () => undefined, play: () => {}, report })
    expect(pressReal("KeyB")).toBe(false)
    expect(pressReal("KeyB", { repeat: true })).toBe(false)
    expect(press("KeyB")).toBe(true)
    expect(report).toHaveBeenCalledTimes(1)
    stop()

    listen()
    expect(pressReal("KeyB")).toBe(true)
  })

  it("leaves the arrow keys to the page", () => {
    const stepSegment = listen()
    expect(press("ArrowLeft", { altKey: true })).toBe(true)
    expect(press("ArrowRight")).toBe(true)
    expect(stepSegment).not.toHaveBeenCalled()
  })
})
