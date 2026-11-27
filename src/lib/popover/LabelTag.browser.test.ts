import { flushSync, mount, unmount } from "svelte"
import { afterEach, describe, expect, it } from "vitest"
import LabelTag from "./LabelTag.svelte"

afterEach(() => document.body.replaceChildren())

const press = (target: Element) =>
  target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }))

describe("LabelTag", () => {
  it("pins its tooltip on a click, for selecting its text, until a press outside both", () => {
    const target = document.body.appendChild(document.createElement("div"))
    const app = mount(LabelTag, { target, props: { label: "m", explanation: { name: "masculine" } } })
    const tag = target.querySelector("button")!
    const tip = target.querySelector("[role=tooltip]")!
    expect(tip.classList).toContain("pointer-events-none")

    tag.click()
    flushSync()
    expect(tip.classList).not.toContain("pointer-events-none")

    press(tip)
    tag.blur()
    flushSync()
    expect(tip.classList).not.toContain("pointer-events-none")

    press(document.body)
    flushSync()
    expect(tip.classList).toContain("pointer-events-none")
    expect(tip.classList).toContain("invisible")
    unmount(app)
  })

  it("lets go on a second click", () => {
    const target = document.body.appendChild(document.createElement("div"))
    const app = mount(LabelTag, { target, props: { label: "m", explanation: { name: "masculine" } } })
    const tag = target.querySelector("button")!
    tag.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }))
    tag.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }))
    flushSync()
    expect(target.querySelector("[role=tooltip]")!.classList).toContain("invisible")
    unmount(app)
  })
})
