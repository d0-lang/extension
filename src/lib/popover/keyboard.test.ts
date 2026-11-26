// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest"
import { listenForKeys } from "./keyboard"

/** Presses `code` on the page, and says whether the page still gets it. */
const press = (code: string, init: KeyboardEventInit = {}): boolean =>
  window.dispatchEvent(new KeyboardEvent("keydown", { code, cancelable: true, ...init }))

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

  it("keeps the topmost entry on Q only while keeping is on and an entry has the button", () => {
    const scroller = document.createElement("div")
    scroller.innerHTML = `<section><button data-keep></button></section>`
    document.body.append(scroller)
    // No layout here, so the entry gets a box below the scroller's top.
    scroller.querySelector("section")!.getBoundingClientRect = () => new DOMRect(0, 0, 100, 40)
    const keep = vi.fn()
    scroller.querySelector("button")!.addEventListener("click", keep)

    stop = listenForKeys({ stepSegment: () => false, scroller: () => scroller, play: () => {} })
    expect(press("KeyQ")).toBe(true)
    stop()

    stop = listenForKeys({ stepSegment: () => false, scroller: () => scroller, play: () => {}, keeps: true })
    expect(press("KeyQ")).toBe(false)
    expect(press("KeyQ", { repeat: true })).toBe(false)
    expect(keep).toHaveBeenCalledTimes(1)
    scroller.remove()
  })

  it("leaves the arrow keys to the page", () => {
    const stepSegment = listen()
    expect(press("ArrowLeft", { altKey: true })).toBe(true)
    expect(press("ArrowRight")).toBe(true)
    expect(stepSegment).not.toHaveBeenCalled()
  })
})
