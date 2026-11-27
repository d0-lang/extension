import { describe, expect, it } from "vitest"
import { samplePieces, SAMPLE_SENTENCE } from "./sample"

describe("samplePieces", () => {
  it("gives every word of the sentence an entry, and keeps the rest as it is", () => {
    const pieces = samplePieces()
    expect(pieces.map((piece) => piece.text).join("")).toBe(SAMPLE_SENTENCE)
    expect(
      pieces.filter((piece) => /\p{L}/u.test(piece.text)).every((piece) => piece.word !== undefined),
    ).toBe(true)
    expect(pieces.find((piece) => piece.text === "Sunday")?.word).toBe("sunday")
  })
})
