import { describe, expect, it } from "vitest"
import { sourceLanguages } from "./languages"

describe("sourceLanguages", () => {
  it("lists each word language once, in the user's order", () => {
    expect(sourceLanguages(["de_en", "ru_en", "de_ru", "ja_en"], ["ja_en", "de_ru"])).toEqual([
      "ja",
      "de",
      "ru",
    ])
  })
})
