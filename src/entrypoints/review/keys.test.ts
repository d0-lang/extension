// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { reviewAction } from "./keys"

const key = (code: string, init: KeyboardEventInit = {}) =>
  reviewAction(new KeyboardEvent("keydown", { code, ...init }))

describe("reviewAction", () => {
  it("takes WASD and vim's letters alike", () => {
    expect(key("KeyW")).toEqual(key("KeyK"))
    expect(key("KeyS")).toEqual({ kind: "focus", step: 1 })
    expect(key("KeyA")).toEqual(key("KeyH"))
    expect(key("KeyD")).toEqual({ kind: "word", step: 1 })
  })

  it("picks a sense by its number, from the row or the keypad", () => {
    expect(key("Digit3")).toEqual({ kind: "sense", index: 2 })
    expect(key("Numpad1")).toEqual({ kind: "sense", index: 0 })
    expect(key("Digit0")).toBeUndefined()
  })

  it("leaves keys with a modifier to the browser", () => {
    expect(key("KeyD", { ctrlKey: true })).toBeUndefined()
    expect(key("Enter", { altKey: true })).toBeUndefined()
  })
})
