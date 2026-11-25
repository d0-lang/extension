import { afterEach, describe, expect, it } from "vitest"
import { createRows } from "./rows"
import "./rows.css"

afterEach(() => {
  document.body.replaceChildren()
})

/** Subtitles centred with `translate`, as Tailwind does, at the bottom of a box. */
const centred = (): HTMLElement => {
  const box = document.createElement("div")
  box.style.cssText = "position: relative; width: 600px; height: 340px"
  const root = document.createElement("div")
  root.dataset.dadictCaptions = ""
  root.style.cssText = "position: absolute; bottom: 0; left: 50%; width: max-content; translate: -50% 0"
  box.append(root)
  document.body.append(box)
  return root
}

describe("createRows", () => {
  it("slides the row before up without moving the subtitles sideways", () => {
    const root = centred()
    const show = createRows(root, { previous: true, slide: true }, () => {})
    show({ text: "Mamy gościa." }, "pl", false)
    show({ text: "Ala ma kota i dwa psy.", previous: { text: "Mamy gościa." } }, "pl", true)
    const [slide] = root.getAnimations()
    slide!.pause()
    slide!.currentTime = 0
    const start = root.getBoundingClientRect()
    slide!.finish()
    const end = root.getBoundingClientRect()
    expect(start.left).toBeCloseTo(end.left, 0)
    expect(start.top).toBeGreaterThan(end.top)
  })

  it("leaves the row before still when the slide is off", () => {
    const root = centred()
    const show = createRows(root, { previous: true, slide: false }, () => {})
    show({ text: "Mamy gościa." }, "pl", false)
    show({ text: "Ala ma kota.", previous: { text: "Mamy gościa." } }, "pl", true)
    expect(root.getAnimations()).toHaveLength(0)
    expect(root.querySelector("[data-previous]")?.textContent).toBe("Mamy gościa.")
  })
  it("slides the cue up over an empty row in the silence, and keeps it there for the next cue", () => {
    const root = centred()
    const show = createRows(root, { previous: true, slide: true }, () => {})
    show({ text: "Mamy gościa." }, "pl", false)
    const said = root.querySelector("[data-cue]")!
    const bottom = said.getBoundingClientRect().bottom
    show({ text: "", previous: { text: "Mamy gościa." } }, "pl", true)
    for (const animation of root.getAnimations()) {
      animation.finish()
    }
    expect(said.hasAttribute("data-previous")).toBe(true)
    expect(said.getBoundingClientRect().bottom).toBeLessThan(bottom)
    const held = said.getBoundingClientRect().top
    show({ text: "Ala ma kota.", previous: { text: "Mamy gościa." } }, "pl", true)
    for (const animation of root.getAnimations()) {
      animation.finish()
    }
    expect(root.querySelector("[data-previous]")).toBe(said)
    expect(said.getBoundingClientRect().top).toBeCloseTo(held, 0)
    expect(root.querySelector("[data-blank]")).toBeNull()
    expect(root.textContent).toBe("Mamy gościa.\nAla ma kota.")
  })
})
