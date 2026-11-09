import { describe, expect, it } from "vitest"
import { clipLine, lineBoxes, sameBoxes } from "./underline"

const box = (left: number, right: number, top: number, bottom: number) => ({ left, right, top, bottom })

describe("lineBoxes", () => {
  it("joins the boxes of a word cut into spans", () => {
    expect(lineBoxes([box(10, 14, 0, 20), box(14, 20, 0, 20), box(20, 30, 0, 20)])).toEqual([
      box(10, 30, 0, 20),
    ])
  })

  it("joins letters lifted by an effect", () => {
    expect(lineBoxes([box(10, 14, 0, 20), box(14, 20, -4, 16)])).toEqual([box(10, 20, -4, 20)])
  })

  it("keeps a wrapped word on two lines", () => {
    expect(lineBoxes([box(200, 240, 0, 20), box(0, 30, 24, 44)])).toEqual([
      box(200, 240, 0, 20),
      box(0, 30, 24, 44),
    ])
  })

  it("drops empty boxes", () => {
    expect(lineBoxes([box(10, 10, 0, 20)])).toEqual([])
  })
})

describe("sameBoxes", () => {
  it("compares boxes by position", () => {
    expect(sameBoxes([box(1, 2, 3, 4)], [box(1, 2, 3, 4)])).toBe(true)
    expect(sameBoxes([box(1, 2, 3, 4)], [box(1, 2, 3, 5)])).toBe(false)
    expect(sameBoxes([], [box(1, 2, 3, 4)])).toBe(false)
  })
})

describe("clipLine", () => {
  const scrollBox = box(0, 100, 0, 50)

  it("keeps a line inside the box", () => {
    expect(clipLine(box(10, 40, 10, 30), scrollBox)).toEqual(box(10, 40, 10, 30))
  })

  it("cuts a line to the box's sides", () => {
    expect(clipLine(box(80, 140, 10, 30), scrollBox)).toEqual(box(80, 100, 10, 30))
  })

  it("drops a line scrolled out above or below", () => {
    expect(clipLine(box(10, 40, -30, -10), scrollBox)).toBeUndefined()
    expect(clipLine(box(10, 40, 40, 60), scrollBox)).toBeUndefined()
  })

  it("drops a line scrolled out sideways", () => {
    expect(clipLine(box(120, 140, 10, 30), scrollBox)).toBeUndefined()
  })
})
