import { describe, expect, it } from "vitest"
import { groupByTarget, pairMatches, sourceName } from "./languages"

describe("groupByTarget", () => {
  it("groups by the target and sorts both by name", () => {
    expect(groupByTarget(["ru_en", "de_en", "en_de", "uk_en"])).toEqual([
      { into: "English", pairs: ["de_en", "ru_en", "uk_en"] },
      { into: "German", pairs: ["en_de"] },
    ])
  })
})

describe("sourceName", () => {
  it("names the language translated from", () => {
    expect(sourceName("uk_en")).toBe("Ukrainian")
  })
})

describe("pairMatches", () => {
  it("matches either name or the code, ignoring case", () => {
    expect(pairMatches("uk_en", "ukr")).toBe(true)
    expect(pairMatches("uk_en", "ENGL")).toBe(true)
    expect(pairMatches("uk_en", "uk_")).toBe(true)
    expect(pairMatches("uk_en", "german")).toBe(false)
  })
})
