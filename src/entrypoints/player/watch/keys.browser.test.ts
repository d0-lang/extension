import { afterEach, describe, expect, it } from "vitest"
import { actionOf } from "./keys"

afterEach(() => {
  document.body.replaceChildren()
})

/** A key pressed in `target`, which is the page when left out. */
const press = (key: string, target: Element = document.body, init: KeyboardEventInit = {}) => {
  let event: KeyboardEvent | undefined
  target.addEventListener("keydown", (pressed) => (event = pressed as KeyboardEvent), { once: true })
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }))
  return actionOf(event!)
}

const element = (html: string): Element => {
  document.body.innerHTML = html
  return document.body.firstElementChild!
}

describe("actionOf", () => {
  it("knows a video site's keys, in either case", () => {
    expect(press(" ")).toBe("toggle")
    expect(press("K")).toBe("toggle")
    expect(press("ArrowLeft")).toBe("back")
    expect(press("f")).toBe("fullscreen")
  })

  it("leaves keys with a modifier, like a lookup's Alt", () => {
    expect(press("f", document.body, { altKey: true })).toBeUndefined()
    expect(press("f", document.body, { ctrlKey: true })).toBeUndefined()
  })

  it("leaves keys to a field or a button, and arrows to a slider", () => {
    expect(press("f", element("<input type=text>"))).toBeUndefined()
    expect(press(" ", element("<button>Play</button>"))).toBeUndefined()
    expect(press("ArrowRight", element("<input type=range>"))).toBeUndefined()
    expect(press(" ", element("<input type=range>"))).toBe("toggle")
  })
})
