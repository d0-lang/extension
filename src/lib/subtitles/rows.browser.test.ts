import { afterEach, describe, expect, it } from "vitest"
import { createRows } from "./rows"
import "./rows.css"

afterEach(() => {
  document.body.replaceChildren()
})

/** Subtitles at the bottom of a box, centred with `translate` as Tailwind does. */
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
  it("fades the next cue in, with nothing moving", () => {
    const root = centred()
    const show = createRows(root, { previous: true, slide: true }, () => {})
    show({ text: "Mamy gościa." }, "pl", false)
    show({ text: "Ala ma kota i dwa psy.", previous: { text: "Mamy gościa." } }, "pl", true)
    expect(
      root.getAnimations({ subtree: true }).map(({ effect }) => (effect as KeyframeEffect).target),
    ).toEqual([root.querySelector("[data-cue]:not([data-previous])")])
  })

  it("shows the next cue at once when the fade is off", () => {
    const root = centred()
    const show = createRows(root, { previous: true, slide: false }, () => {})
    show({ text: "Mamy gościa." }, "pl", false)
    show({ text: "Ala ma kota.", previous: { text: "Mamy gościa." } }, "pl", true)
    expect(root.getAnimations({ subtree: true })).toHaveLength(0)
    expect(root.querySelector("[data-previous]")?.textContent).toBe("Mamy gościa.")
  })
})
