import { afterEach, describe, expect, it } from "vitest"
import { highlightRanges } from "./highlight"

const rangeOn = (text: string): Range => {
  document.body.innerHTML = `<p>${text}</p>`
  const range = document.createRange()
  range.selectNodeContents(document.querySelector("p")!.firstChild!)
  return range
}

afterEach(() => {
  document.body.innerHTML = ""
  CSS.highlights.clear()
})

describe("highlightRanges", () => {
  it("registers the ranges under the style and the page's shade", () => {
    const range = rangeOn("Rettungsfonds")
    highlightRanges([range], "tint", false)
    highlightRanges([range], "underline", true)
    expect([...CSS.highlights.get("dadict-tint")!]).toEqual([range])
    expect(CSS.highlights.has("dadict-underline-dark")).toBe(true)
  })

  it("removes its highlight when done", () => {
    const remove = highlightRanges([rangeOn("Rettungsfonds")], "tint", false)
    remove()
    expect(CSS.highlights.has("dadict-tint")).toBe(false)
  })

  it("leaves a newer highlight with the same name", () => {
    const range = rangeOn("Rettungsfonds")
    const removeOld = highlightRanges([range], "tint", false)
    highlightRanges([range], "tint", false)
    removeOld()
    expect(CSS.highlights.has("dadict-tint")).toBe(true)
  })

  it("leaves the page's own highlights", () => {
    const range = rangeOn("Rettungsfonds")
    CSS.highlights.set("search", new Highlight(range))
    highlightRanges([range], "tint", false)()
    expect(CSS.highlights.has("search")).toBe(true)
  })
})
