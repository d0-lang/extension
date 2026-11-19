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

  it("leaves the arrow keys to the page", () => {
    const stepSegment = listen()
    expect(press("ArrowLeft", { altKey: true })).toBe(true)
    expect(press("ArrowRight")).toBe(true)
    expect(stepSegment).not.toHaveBeenCalled()
  })
})
