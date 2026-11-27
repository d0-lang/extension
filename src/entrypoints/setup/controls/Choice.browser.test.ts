import { flushSync, mount, unmount } from "svelte"
import { describe, expect, it } from "vitest"
import ChoiceTest from "./ChoiceTest.svelte"

describe("Choice", () => {
  it("keeps the picked item when it is pressed again, and moves to another one", () => {
    const picks: Array<string> = []
    const target = document.body.appendChild(document.createElement("div"))
    const app = mount(ChoiceTest, { target, props: { onPick: (value: string) => picks.push(value) } })
    const [slow, fast] = target.querySelectorAll("button")

    slow!.click()
    flushSync()
    expect(slow!.getAttribute("data-state")).toBe("on")
    expect(picks).toEqual([])

    fast!.click()
    flushSync()
    expect(fast!.getAttribute("data-state")).toBe("on")
    expect(slow!.getAttribute("data-state")).toBe("off")
    expect(picks).toEqual(["fast"])
    unmount(app)
  })
})
