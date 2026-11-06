import { describe, expect, it } from "vitest"
import { placePopover, roomOn } from "./position"

const viewport = { width: 1000, height: 800 }
const size = (height: number) => ({ width: 300, height })
const at = (y: number) => ({ top: y, bottom: y + 20, left: 100, right: 140 })

describe("placePopover", () => {
  it("goes below the word when it fits", () => {
    expect(placePopover(at(100), size(300), viewport)).toMatchObject({ top: 126, side: "below" })
  })

  it("goes above when below is too small and above is roomier", () => {
    expect(placePopover(at(600), size(300), viewport)).toMatchObject({ top: 294, side: "above" })
  })

  it("stays below when locked there, even if above would fit better", () => {
    expect(placePopover(at(600), size(150), viewport, "below")).toMatchObject({ top: 626, side: "below" })
  })

  it("keeps the bottom edge put when locked above and the content shrinks", () => {
    const tall = placePopover(at(600), size(300), viewport, "above")
    const short = placePopover(at(600), size(100), viewport, "above")
    expect(tall.top + 300).toBe(short.top + 100)
    expect(short.side).toBe("above")
  })

  it("caps the height at the room on the chosen side", () => {
    expect(roomOn("below", at(600), viewport)).toBe(166)
    expect(roomOn("above", at(600), viewport)).toBe(586)
    expect(placePopover(at(600), size(150), viewport, "below").maxHeight).toBe(166)
  })

  it("does not cover the word when neither side fits", () => {
    const small = { width: 1000, height: 600 }
    const word = at(300)
    const place = placePopover(word, size(500), small)
    expect(place).toMatchObject({ side: "above", maxHeight: 286 })
    expect(place.top + place.maxHeight).toBeLessThanOrEqual(word.top)
  })

  it("takes at most half of a short viewport", () => {
    expect(placePopover(at(50), size(500), { width: 1000, height: 600 }).maxHeight).toBe(300)
  })

  it("covers the word rather than shrink below the minimum room", () => {
    const tiny = { width: 1000, height: 250 }
    const place = placePopover({ top: 110, bottom: 130, left: 100, right: 140 }, size(300), tiny)
    expect(place).toMatchObject({ side: "below", maxHeight: 120 })
    expect(place.top).toBeLessThan(130)
  })
})
