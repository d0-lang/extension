import { describe, expect, it } from "vitest"
import { spread } from "./previews.svelte"

describe("spread", () => {
  it("has every index once, the gaps between them halving", () => {
    expect(spread(5)).toEqual([0, 4, 2, 1, 3])
    expect(spread(8)).toEqual([0, 4, 2, 6, 1, 3, 5, 7])
  })

  it("has the only index of a single frame", () => {
    expect(spread(1)).toEqual([0])
  })
})
