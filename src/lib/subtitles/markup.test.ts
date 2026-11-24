import { describe, expect, it } from "vitest"
import { plainText } from "./markup"

describe("plainText", () => {
  it("drops tags and speakers, and reads entities", () => {
    expect(plainText("<v Anna><i>Ala</i> ma &amp; <b>kota</b></v>")).toBe("Ala ma & kota")
  })

  it("drops the position tags SRT files take from ASS", () => {
    expect(plainText("{\\an8}Ala ma kota")).toBe("Ala ma kota")
  })

  it("keeps lines, without empty ones or extra spaces", () => {
    expect(plainText("  Ala  ma\n\n  kota ")).toBe("Ala ma\nkota")
  })
})
