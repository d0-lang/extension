import { describe, expect, it } from "vitest"
import { dropIndex, moved } from "./reorder"

describe("dropIndex", () => {
  it("lands after every item whose middle is above the pointer", () => {
    expect(dropIndex([20, 60, 100], 10)).toBe(0)
    expect(dropIndex([20, 60, 100], 70)).toBe(2)
    expect(dropIndex([20, 60, 100], 200)).toBe(3)
  })
})

describe("moved", () => {
  it("moves an item down and up", () => {
    expect(moved(["de", "pl", "ja"], "de", 2)).toEqual(["pl", "ja", "de"])
    expect(moved(["de", "pl", "ja"], "ja", 0)).toEqual(["ja", "de", "pl"])
  })

  it("keeps the order when dropped where it was", () => {
    expect(moved(["de", "pl", "ja"], "pl", 1)).toEqual(["de", "pl", "ja"])
  })
})
