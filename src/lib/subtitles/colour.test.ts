import { describe, expect, it } from "vitest"
import { oklchOf, readableColour } from "./colour"

describe("oklchOf", () => {
  it("finds OKLCH as OKLab's reference does", () => {
    const white = oklchOf("#ffffff")!
    expect(white.l).toBeCloseTo(1, 3)
    expect(white.c).toBeCloseTo(0, 3)
    const blue = oklchOf("#0000FF")!
    expect(blue.l).toBeCloseTo(0.452, 3)
    expect(blue.c).toBeCloseTo(0.313, 3)
    expect(blue.h).toBeCloseTo(264.05, 1)
    expect(oklchOf("red")).toBeUndefined()
  })
})

describe("readableColour", () => {
  it("keeps a colour light enough to read", () => {
    expect(readableColour("#ffff00")).toBe("#ffff00")
    expect(readableColour("#00ff00")).toBe("#00ff00")
  })

  it("lightens a dark colour, keeping its hue", () => {
    expect(readableColour("#0000ff")).toBe("oklch(0.72 0.200 264.1)")
    expect(readableColour("#800000")).toMatch(/^oklch\(0\.72 0\.\d{3} 29\.\d\)$/u)
  })

  it("leaves out black and dark greys, which have no hue to keep", () => {
    expect(readableColour("#000000")).toBeUndefined()
    expect(readableColour("#333333")).toBeUndefined()
  })

  it("keeps a colour written another way", () => {
    expect(readableColour("red")).toBe("red")
  })
})
