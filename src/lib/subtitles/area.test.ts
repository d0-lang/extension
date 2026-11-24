import { describe, expect, it } from "vitest"
import { shiftInto } from "./area"

const area = { top: 0, bottom: 100, left: 0, right: 200 }

describe("shiftInto", () => {
  it("leaves a box already inside", () => {
    expect(shiftInto({ top: 10, bottom: 20, left: 10, right: 50 }, area)).toEqual({ x: 0, y: 0 })
  })

  it("moves a box back in by as much as it sticks out", () => {
    expect(shiftInto({ top: -15, bottom: 5, left: 190, right: 230 }, area)).toEqual({ x: -30, y: 15 })
  })

  it("centres a box too big for the area", () => {
    expect(shiftInto({ top: 10, bottom: 20, left: -50, right: 250 }, area)).toEqual({ x: 0, y: 0 })
    expect(shiftInto({ top: 10, bottom: 20, left: 0, right: 300 }, area)).toEqual({ x: -50, y: 0 })
  })
})
