// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { fieldAction, reviewAction } from "./keys"

const key = (code: string, init: KeyboardEventInit = {}) =>
  reviewAction(new KeyboardEvent("keydown", { code, ...init }))

describe("reviewAction", () => {
  it("goes up and down with W/S or K/J, through entries with A/D or H/L, and through words with Shift", () => {
    expect(key("KeyS")).toEqual({ kind: "focus", step: 1 })
    expect(key("KeyK")).toEqual({ kind: "focus", step: -1 })
    expect(key("KeyD")).toEqual({ kind: "entry", step: 1 })
    expect(key("KeyH")).toEqual({ kind: "entry", step: -1 })
    expect(key("KeyS", { shiftKey: true })).toEqual({ kind: "word", step: 1 })
    expect(key("KeyK", { shiftKey: true })).toEqual({ kind: "word", step: -1 })
    expect(key("KeyD", { shiftKey: true })).toBeUndefined()
  })

  it("edits with E or I, acts on the selection with Space or Enter, and sends on Ctrl + Enter", () => {
    expect(key("KeyE")).toEqual({ kind: "edit" })
    expect(key("KeyI")).toEqual({ kind: "edit" })
    expect(key("Space")).toEqual({ kind: "activate" })
    expect(key("Enter")).toEqual({ kind: "activate" })
    expect(key("Enter", { ctrlKey: true })).toEqual({ kind: "send" })
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
