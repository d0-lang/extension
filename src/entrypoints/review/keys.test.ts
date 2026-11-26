// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { fieldAction, reviewAction } from "./keys"

const key = (code: string, init: KeyboardEventInit = {}) =>
  reviewAction(new KeyboardEvent("keydown", { code, ...init }))

describe("reviewAction", () => {
  it("moves between words with Shift and W/S or K/J, and within one with A/D or H/L", () => {
    expect(key("KeyS", { shiftKey: true })).toEqual({ kind: "word", step: 1 })
    expect(key("KeyK", { shiftKey: true })).toEqual({ kind: "word", step: -1 })
    expect(key("KeyD")).toEqual({ kind: "focus", step: 1 })
    expect(key("KeyH")).toEqual({ kind: "focus", step: -1 })
    expect(key("KeyW")).toBeUndefined()
  })

  it("edits with E or I, sends on Ctrl + Enter, and leaves a plain Enter alone", () => {
    expect(key("KeyE")).toEqual({ kind: "edit" })
    expect(key("KeyI")).toEqual({ kind: "edit" })
    expect(key("Enter", { ctrlKey: true })).toEqual({ kind: "send" })
    expect(key("Enter")).toBeUndefined()
  })

  it("picks a meaning by its number, from the row or the keypad", () => {
    expect(key("Digit3")).toEqual({ kind: "sense", index: 2 })
    expect(key("Numpad1")).toEqual({ kind: "sense", index: 0 })
    expect(key("Digit0")).toBeUndefined()
  })

  it("leaves other keys with a modifier to the browser", () => {
    expect(key("KeyD", { ctrlKey: true })).toBeUndefined()
    expect(key("KeyX", { altKey: true })).toBeUndefined()
  })
})

describe("fieldAction", () => {
  const field = (keyName: string, init: KeyboardEventInit = {}) =>
    fieldAction(new KeyboardEvent("keydown", { key: keyName, code: keyName, ...init }))

  it("keeps on Enter, cancels on Escape, and sends on Ctrl + Enter", () => {
    expect(field("Enter")).toBe("keep")
    expect(field("Escape")).toBe("cancel")
    expect(field("Enter", { ctrlKey: true })).toBe("send")
    expect(field("a")).toBeUndefined()
  })
})
