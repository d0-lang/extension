import { describe, expect, it } from "vitest"
import { wordSearch } from "./duplicates"

describe("wordSearch", () => {
  it("searches the Word field as a card writes it, with stress drawn and quotes escaped", () => {
    expect(wordSearch("до́ма")).toBe(
      String.raw`"note:DaDict" "Word:д<span class=\"stress\" data-lift=\"0\">о</span>ма"`,
    )
  })

  it("keeps Anki's wildcards literal", () => {
    expect(wordSearch("a_b*c")).toBe(String.raw`"note:DaDict" "Word:a\_b\*c"`)
  })
})
