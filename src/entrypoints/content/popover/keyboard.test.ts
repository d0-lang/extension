// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest"
import { listenForKeys } from "./keyboard"

/** Presses `code` on the page, and says whether the page still gets it. */
const press = (code: string, init: KeyboardEventInit = {}): boolean =>
  window.dispatchEvent(new KeyboardEvent("keydown", { code, cancelable: true, ...init }))

describe("listenForKeys", () => {
  let stop: () => void

  /** Listens with every part and language there to step to, unless `hasPart` says otherwise. */
  const listen = (hasPart = true) => {
    const keys = {
      stepSegment: vi.fn((_step: 1 | -1) => hasPart),
      stepLanguage: vi.fn((_step: 1 | -1) => true),
    }
    stop = listenForKeys({ ...keys, scroller: () => undefined, play: () => {} })
    return keys
  }

  afterEach(() => stop())

  it("moves between parts on A and D", () => {
    const { stepSegment, stepLanguage } = listen()
    expect(press("KeyA")).toBe(false)
    expect(press("KeyD")).toBe(false)
    expect(stepSegment.mock.calls).toEqual([[-1], [1]])
    expect(stepLanguage).not.toHaveBeenCalled()
  })

  it("switches language on Shift + A and D, with Alt held too", () => {
    const { stepSegment, stepLanguage } = listen()
    expect(press("KeyA", { shiftKey: true })).toBe(false)
    expect(press("KeyD", { shiftKey: true, altKey: true })).toBe(false)
    expect(stepLanguage.mock.calls).toEqual([[-1], [1]])
    expect(stepSegment).not.toHaveBeenCalled()
  })

  it("lets A and D reach the page when there is no other part", () => {
    listen(false)
    expect(press("KeyA")).toBe(true)
    expect(press("KeyD", { altKey: true })).toBe(true)
  })

  it("leaves the arrow keys to the page", () => {
    const { stepSegment, stepLanguage } = listen()
    expect(press("ArrowLeft", { altKey: true })).toBe(true)
    expect(press("ArrowRight")).toBe(true)
    expect(stepSegment).not.toHaveBeenCalled()
    expect(stepLanguage).not.toHaveBeenCalled()
  })
})
