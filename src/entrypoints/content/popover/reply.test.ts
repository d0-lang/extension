import { describe, expect, it } from "vitest"
import type { LookupReply } from "$lib/messages"
import { shownSplit, steppedTab, wholeOnTop } from "./reply"

const entry = (lemma: string) => ({ lemma, pos: "X", senses: [{ glosses: [lemma] }] })

const reply = (
  lemmas: Array<string>,
  segments: Array<{ text: string; entries?: Array<number> }>,
): LookupReply => ({
  ok: true,
  languages: ["xx_en"],
  paused: [],
  tried: ["xx_en"],
  lang: "xx_en",
  server: undefined,
  sources: [],
  labels: {},
  entries: lemmas.map(entry),
  segments,
})

const split = (
  lemmas: Array<string>,
  segments: Array<{ text: string; entries?: Array<number> }>,
  word: string,
) => shownSplit(reply(lemmas, segments), word, false, undefined)!

const lemmasOf = (parts: ReturnType<typeof split>["parts"]) =>
  parts.map((part) => part.entries.map((e) => e.lemma))

describe("shownSplit", () => {
  it("opens on the segment with the lowest entry index, keeping written order", () => {
    const shown = split(
      ["-pend-", "ni-", "-na-", "-ku-"],
      [
        { text: "ni", entries: [1] },
        { text: "na", entries: [2] },
        { text: "ku", entries: [3] },
        { text: "pend", entries: [0] },
        { text: "a" },
      ],
      "ninakupenda",
    )
    expect(shown.parts.map((part) => part.text)).toEqual(["ni", "na", "ku", "pend", "a"])
    expect(shown.opens).toBe(3)
  })

  it("opens on the first segment when entries come in segment order", () => {
    const shown = split(
      ["Rettung", "Fonds"],
      [{ text: "Rettung", entries: [0] }, { text: "s" }, { text: "fonds", entries: [1] }],
      "Rettungsfonds",
    )
    expect(shown.opens).toBe(0)
  })

  it("puts the whole word's entries on top of the main segment", () => {
    // `送る` is in no segment, so it belongs to the whole word; `送り` outranks `お`.
    const shown = split(
      ["送る", "送り", "お"],
      [
        { text: "お", entries: [2] },
        { text: "送り", entries: [1] },
      ],
      "お送り",
    )
    expect(shown.opens).toBe(1)
    expect(lemmasOf(shown.parts)).toEqual([["お"], ["送る", "送り"]])
  })

  it("opens on the first segment when no segment has entries", () => {
    const shown = split(["Haupt"], [{ text: "Haupt" }, { text: "bahnhof" }], "Hauptbahnhof")
    expect(shown.opens).toBe(0)
    expect(lemmasOf(shown.parts)).toEqual([["Haupt"], []])
  })
})

describe("wholeOnTop", () => {
  const oSend = () =>
    split(
      ["送る", "送り", "お"],
      [
        { text: "お", entries: [2] },
        { text: "送り", entries: [1] },
      ],
      "お送り",
    )

  it("sets the whole word's entries apart on the main segment only", () => {
    const shown = oSend()
    expect(wholeOnTop(shown, 1)).toBe(1)
    expect(wholeOnTop(shown, 0)).toBe(0)
  })

  it("leaves them alone when the tab holds nothing else", () => {
    const shown = split(["Haupt"], [{ text: "Haupt" }, { text: "bahnhof" }], "Hauptbahnhof")
    expect(wholeOnTop(shown, 0)).toBe(0)
  })
})

describe("steppedTab", () => {
  const rettungsfonds = () =>
    split(
      ["Rettung", "Fonds"],
      [{ text: "Rettung", entries: [0] }, { text: "s" }, { text: "fonds", entries: [1] }],
      "Rettungsfonds",
    )

  it("skips parts without entries", () => {
    expect(steppedTab(rettungsfonds(), 0, 1)).toBe(2)
    expect(steppedTab(rettungsfonds(), 2, -1)).toBe(0)
  })

  it("wraps around at the ends", () => {
    expect(steppedTab(rettungsfonds(), 2, 1)).toBe(0)
    expect(steppedTab(rettungsfonds(), 0, -1)).toBe(2)
  })

  it("is unset with only one part to pick", () => {
    const shown = split(["食べる"], [{ text: "食べ", entries: [0] }, { text: "ました" }], "食べました")
    expect(steppedTab(shown, 0, 1)).toBeUndefined()
  })
})
