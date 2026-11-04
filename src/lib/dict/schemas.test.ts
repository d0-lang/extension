import { describe, expect, it } from "vitest"
import { lookupResultSchema } from "./schemas"

const body = (sense: object) => ({ entries: [{ lemma: "mata", pos: "NOUN", senses: [sense] }] })

describe("lookupResultSchema", () => {
  it("keeps see", () => {
    const parsed = lookupResultSchema.parse(body({ translations: ["synonym of matka"], see: ["matka"] }))
    expect(parsed.entries[0]?.senses[0]?.see).toEqual(["matka"])
  })

  it("keeps segments", () => {
    const parsed = lookupResultSchema.parse({ ...body({ translations: ["in"] }), segments: [{ text: "ssa", entries: [0] }] })
    expect(parsed.segments).toEqual([{ text: "ssa", entries: [0] }])
  })

  it("drops malformed segments but keeps the entries", () => {
    const parsed = lookupResultSchema.parse({ ...body({ translations: ["in"] }), segments: [{ text: "ssa", entries: [-1] }] })
    expect(parsed.segments).toBeUndefined()
    expect(parsed.entries).toHaveLength(1)
  })

  it("accepts a sense without see", () => {
    const parsed = lookupResultSchema.parse(body({ translations: ["mat (floor pad)"] }))
    expect(parsed.entries[0]?.senses[0]).toEqual({ translations: ["mat (floor pad)"] })
  })
})
