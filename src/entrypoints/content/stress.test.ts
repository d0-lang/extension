import { describe, expect, it } from "vitest"
import { splitStress, stressedLetter } from "./stress"

describe("splitStress", () => {
  it("sets the stressed letter apart without its mark", () => {
    expect(splitStress("техноло́гии")).toEqual([
      { text: "технол", stressed: false },
      { text: "о", stressed: true },
      { text: "гии", stressed: false },
    ])
  })

  it("handles several stresses and one at either end", () => {
    expect(splitStress("о́ба́")).toEqual([
      { text: "о", stressed: true },
      { text: "б", stressed: false },
      { text: "а", stressed: true },
    ])
  })

  it("keeps the other marks on a stressed letter", () => {
    expect(splitStress("ё́ж")).toEqual([
      { text: "ё", stressed: true },
      { text: "ж", stressed: false },
    ])
  })

  it("returns text without stress marks whole", () => {
    expect(splitStress("die Arbeit")).toEqual([{ text: "die Arbeit", stressed: false }])
  })

  it("keeps a stray mark with nothing before it", () => {
    expect(splitStress("́а")).toEqual([{ text: "́а", stressed: false }])
  })
})

describe("stressedLetter", () => {
  it("drops the dot the accent replaces", () => {
    expect(stressedLetter("і")).toEqual({ text: "ı", lift: 0 })
    expect(stressedLetter("i")).toEqual({ text: "ı", lift: 0 })
  })

  it("lifts the accent over marks above and capitals", () => {
    expect(stressedLetter("а")).toEqual({ text: "а", lift: 0 })
    expect(stressedLetter("ї")).toEqual({ text: "ї", lift: 1 })
    expect(stressedLetter("ё")).toEqual({ text: "ё", lift: 1 })
    expect(stressedLetter("О")).toEqual({ text: "О", lift: 1 })
    expect(stressedLetter("Ї")).toEqual({ text: "Ї", lift: 2 })
  })

  it("leaves it low over a mark below", () => {
    expect(stressedLetter("ą")).toEqual({ text: "ą", lift: 0 })
  })
})
