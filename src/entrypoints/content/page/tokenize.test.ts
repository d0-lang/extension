import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { segmentsOf, tokensAt } from "./tokenize"

/** Like Firefox's segmenter, which leaves `isWordLike` false on `あれ` in `あれ、` and on `行く` in `行く？`. */
class NoWordLikeSegmenter extends Intl.Segmenter {
  override segment(input: string): Intl.Segments {
    const segments = super.segment(input)
    const strip = <Segment extends Intl.SegmentData | undefined>(segment: Segment): Segment =>
      segment === undefined ? segment : { ...segment, isWordLike: false }
    return {
      containing: (index) => strip(segments.containing(index)),
      [Symbol.iterator]: () => Array.from(segments, strip)[Symbol.iterator](),
    }
  }
}

describe("without isWordLike from the segmenter", () => {
  beforeAll(() => {
    vi.stubGlobal("Intl", Object.create(Intl, { Segmenter: { value: NoWordLikeSegmenter } }))
  })
  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it("finds a word before punctuation", () => {
    expect(tokensAt("あれ、朝ごはん食べてないの？", 1, "ja")).toContainEqual({ start: 0, end: 2 })
    expect(tokensAt("行く？", 0, "ja")).toContainEqual({ start: 0, end: 2 })
  })

  it("keeps punctuation and numbers out of the words", () => {
    expect(segmentsOf("行く？ 3", "ja").filter(({ word }) => word)).toEqual([{ text: "行く", word: true }])
  })
})
