import { describe, expect, it } from "vitest"
import { orderLanguages } from "./languages"

describe("orderLanguages", () => {
  it("puts the ordered languages first", () => {
    expect(orderLanguages(["de_en", "pl_en", "ja_en"], ["ja_en", "de_en"])).toEqual([
      "ja_en",
      "de_en",
      "pl_en",
    ])
  })

  it("skips ordered languages that are not bound", () => {
    expect(orderLanguages(["de_en", "pl_en"], ["uk_en", "pl_en"])).toEqual(["pl_en", "de_en"])
  })

  it("keeps the order without one stored", () => {
    expect(orderLanguages(["de_en", "pl_en"], [])).toEqual(["de_en", "pl_en"])
  })
})
