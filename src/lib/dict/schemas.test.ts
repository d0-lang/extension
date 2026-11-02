import { describe, expect, it } from "vitest"
import { lookupResultSchema } from "./schemas"

const body = (sense: object) => ({ entries: [{ lemma: "mata", pos: "NOUN", senses: [sense] }] })

describe("lookupResultSchema", () => {
  it("keeps see", () => {
    const parsed = lookupResultSchema.parse(body({ translations: ["synonym of matka"], see: ["matka"] }))
    expect(parsed.entries[0]?.senses[0]?.see).toEqual(["matka"])
  })

  it("accepts a sense without see", () => {
    const parsed = lookupResultSchema.parse(body({ translations: ["mat (floor pad)"] }))
    expect(parsed.entries[0]?.senses[0]).toEqual({ translations: ["mat (floor pad)"] })
  })
})
