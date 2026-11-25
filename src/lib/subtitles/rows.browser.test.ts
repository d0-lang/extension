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
  it("dims the cue in place in the silence, and slides it up from there for the next cue", () => {
    const root = centred()
    const show = createRows(root, { previous: true, slide: true }, () => {})
    show({ text: "Mamy gościa." }, "pl", false)
    const said = root.querySelector<HTMLElement>("[data-cue]")!
    const word = said.querySelector("[data-word]")!
    const top = word.getBoundingClientRect().top
    expect(show({ text: "Mamy gościa.", held: true }, "pl", true)).toBe(true)
    expect(root.querySelector("[data-cue]")).toBe(said)
    expect(said.hasAttribute("data-held")).toBe(true)
    expect(word.getBoundingClientRect().top).toBe(top)
    show({ text: "Ala ma kota.", previous: { text: "Mamy gościa." } }, "pl", true)
    expect(root.querySelector("[data-previous]")).toBe(said)
    expect(said.hasAttribute("data-held")).toBe(false)
    expect(root.getAnimations()).not.toHaveLength(0)
  })
  it("draws a dark colour lighter, and a black one white", () => {
    const root = centred()
    const show = createRows(root, { previous: true, slide: true }, () => {})
    const styles = [
      { color: "#000080", from: 0, to: 5 },
      { color: "#000000", from: 6, to: 10 },
    ]
    show({ text: "Niebo nocą", styles }, "pl", false)
    const [sky, night] = root.querySelectorAll("[data-word]")
    expect((sky as HTMLElement).style.color).toMatch(/^oklch\(0\.72 /u)
    expect((night as HTMLElement).style.color).toBe("")
  })
})
