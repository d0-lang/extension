import { describe, expect, it } from "vitest"
import { splitStress } from "./stress"

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
