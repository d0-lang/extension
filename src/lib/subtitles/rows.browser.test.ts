import { afterEach, describe, expect, it } from "vitest"
import { readableColour } from "./colour"
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

  it("draws a reading over its characters, which is not the words' text", () => {
    const root = centred()
    const show = createRows(root, { previous: true, slide: false }, () => {})
    show({ text: "どこか遠国に", ruby: [{ from: 3, to: 5, text: "おんごく" }] }, "ja", false)
    const base = root.querySelector<HTMLElement>("[data-ruby]")!
    expect(base.textContent).toBe("遠国")
    expect(base.dataset.ruby).toBe("おんごく")
    expect(base.closest("[data-word]")?.textContent).toContain("遠国")
    expect(root.textContent).toBe("どこか遠国に")
    const reading = getComputedStyle(base, "::before")
    expect(reading.content).toBe('"おんごく"')
    // The line makes room for the readings above it.
    expect(parseFloat(getComputedStyle(base.closest("[data-line]")!).paddingTop)).toBeGreaterThan(0)
  })

  it("makes room for readings above their row only, leaving the line below where it was", () => {
    const gapBelowFirst = (ruby: Array<{ from: number; to: number; text: string }>) => {
      const root = centred()
      const show = createRows(root, { previous: true, slide: false }, () => {})
      show({ text: "我らは賤ヶ岳での戦以来\n命を的に数々の功を", ruby }, "ja", false)
      const [first, second] = [...root.querySelectorAll("[data-line]")].map((line) =>
        line.getBoundingClientRect(),
      )
      root.parentElement!.remove()
      return { gap: second!.top - first!.bottom, height: second!.height }
    }
    const plain = gapBelowFirst([])
    const read = gapBelowFirst([{ from: 3, to: 6, text: "しずがたけ" }])
    expect(read.gap).toBeCloseTo(plain.gap, 0)
    expect(read.height).toBeCloseTo(plain.height, 0)
  })

  it("draws a reading inside its line's background", () => {
    const root = centred()
    const show = createRows(root, { previous: true, slide: false }, () => {})
    show({ text: "我らは賤ヶ岳での戦以来", ruby: [{ from: 3, to: 6, text: "しずがたけ" }] }, "ja", false)
    const base = root.querySelector<HTMLElement>("[data-ruby]")!
    // The reading takes the top of its characters' box.
    expect(base.closest("[data-line]")!.getBoundingClientRect().top).toBeLessThanOrEqual(
      base.getBoundingClientRect().top,
    )
  })

  it("takes a click on a reading as one on the word it is over", () => {
    const root = centred()
    const show = createRows(root, { previous: true, slide: false }, () => {})
    show({ text: "我らは賤ヶ岳での戦以来", ruby: [{ from: 3, to: 6, text: "しずがたけ" }] }, "ja", false)
    const base = root.querySelector<HTMLElement>("[data-ruby]")!
    const box = base.getBoundingClientRect()
    const reading = parseFloat(getComputedStyle(base).paddingTop) / 2
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + reading)
    expect(hit?.closest("[data-word]")).toBe(base.closest("[data-word]"))
  })

  it("takes a click on a reading wider than its characters as one on them, out to its ends", () => {
    const root = centred()
    const show = createRows(root, { previous: true, slide: false }, () => {})
    show({ text: "志を持つ", ruby: [{ from: 0, to: 1, text: "こころざし" }] }, "ja", false)
    const base = root.querySelector<HTMLElement>("[data-ruby]")!
    const box = base.getBoundingClientRect()
    const top = box.top + parseFloat(getComputedStyle(base).paddingTop) / 2
    // The reading is wider than 志, so its last kana stand out past the character's box.
    const hit = document.elementFromPoint(box.right + box.width * 0.4, top)
    expect(hit?.closest("[data-word]")).toBe(base.closest("[data-word]"))
  })

  it("keeps the styles of the words a reading joins", () => {
    const root = centred()
    const show = createRows(root, { previous: true, slide: false }, () => {})
    show(
      {
        text: "one two",
        styles: [
          { color: "#ff0000", from: 0, to: 3 },
          { color: "#0000ff", from: 4, to: 7 },
        ],
        ruby: [{ from: 2, to: 5, text: "x" }],
      },
      "en",
      false,
    )
    const colourOf = (text: string) =>
      [...root.querySelectorAll<HTMLElement>("[data-line] span")].find(
        (span) => span.children.length === 0 && span.textContent === text,
      )?.style.color
    // As an element's style reads a colour back, lightened the way the rows draw a dark one.
    const drawn = (colour: string) => {
      const probe = document.createElement("span")
      probe.style.color = readableColour(colour) ?? ""
      return probe.style.color
    }
    expect(colourOf("on")).toBe(drawn("#ff0000"))
    expect(colourOf("wo")).toBe(drawn("#0000ff"))
    expect(root.querySelector("[data-word]")?.textContent).toBe("one two")
  })

  it("makes the words a reading is over one word", () => {
    const root = centred()
    const show = createRows(root, { previous: true, slide: false }, () => {})
    show({ text: "Ich lese gern", ruby: [{ from: 2, to: 6, text: "x" }] }, "de", false)
    const words = [...root.querySelectorAll("[data-word]")].map((word) => word.textContent)
    expect(words).toEqual(["Ich lese", "gern"])
  })
})
