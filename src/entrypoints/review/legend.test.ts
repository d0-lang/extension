// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { reviewAction } from "./keys"
import { legendRow, litKeys, pressedKeys } from "./legend"
import type { Focus } from "./review.svelte"

const press = (code: string, init: KeyboardEventInit = {}) => new KeyboardEvent("keydown", { code, ...init })

const rowOf = (code: string, init: KeyboardEventInit = {}, focus: Focus = 0) => {
  const action = reviewAction(press(code, init))
  return action === undefined ? undefined : legendRow(action, focus)
}

describe("legendRow", () => {
  it("finds the row each action is listed on", () => {
    expect(rowOf("KeyS")).toBe(0)
    expect(rowOf("KeyJ", { shiftKey: true })).toBe(1)
    expect(rowOf("KeyH")).toBe(2)
    expect(rowOf("Digit4")).toBe(3)
    expect(rowOf("Space")).toBe(3)
    expect(rowOf("KeyI")).toBe(4)
    expect(rowOf("Enter", { ctrlKey: true })).toBe(5)
    expect(rowOf("KeyX")).toBe(6)
    expect(rowOf("Escape")).toBeUndefined()
  })

  it("puts Space and Enter on the row of what they do on the selection", () => {
    expect(rowOf("Enter", {}, 2)).toBe(3)
    expect(rowOf("Enter", {}, "send")).toBe(5)
    expect(rowOf("Space", {}, "drop")).toBe(6)
    expect(rowOf("Space", {}, "sentence")).toBe(4)
  })
})

describe("pressedKeys", () => {
  it("names keys as the legend does, modifiers first", () => {
    expect(pressedKeys(press("KeyW", { shiftKey: true }))).toEqual(["Shift", "W"])
    expect(pressedKeys(press("NumpadEnter", { metaKey: true }))).toEqual(["Ctrl", "Enter"])
    expect(pressedKeys(press("Numpad7"))).toEqual(["1–9"])
    expect(pressedKeys(press("ArrowUp"))).toEqual([])
  })
})

describe("litKeys", () => {
  it("lights the pressed keys only in the group that has the key itself", () => {
    expect(litKeys(["Shift", "W", "S"], ["Shift", "K"])).toEqual([false, false, false])
    expect(litKeys(["Shift", "K", "J"], ["Shift", "K"])).toEqual([true, true, false])
    expect(litKeys(["Ctrl", "Enter"], ["Ctrl", "Enter"])).toEqual([true, true])
    expect(litKeys(["Enter"], ["Ctrl"])).toEqual([false])
  })
})
