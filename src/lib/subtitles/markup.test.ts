import { describe, expect, it } from "vitest"
import { plainText, styledText } from "./markup"

describe("plainText", () => {
  it("drops tags and speakers, and reads entities", () => {
    expect(plainText("<v Anna><i>Ala</i> ma &amp; <b>kota</b></v>")).toBe("Ala ma & kota")
  })

  it("drops the position tags SRT files take from ASS", () => {
    expect(plainText("{\\an8}Ala ma kota")).toBe("Ala ma kota")
  })

  it("keeps lines, without empty ones or extra spaces", () => {
    expect(plainText("  Ala  ma\n\n  kota ")).toBe("Ala ma\nkota")
  })
})

describe("ruby", () => {
  it("leaves readings out of the plain text, rather than running them into the words", () => {
    expect(plainText("<ruby>漢字<rt>かんじ</rt></ruby>を読む")).toBe("漢字を読む")
    expect(plainText("<ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>")).toBe("漢字")
    expect(plainText("<ruby>漢<rt>かん</ruby>字")).toBe("漢字")
  })

  it("puts each reading over the characters before its rt", () => {
    expect(styledText("<ruby>漢<rt>かん</rt>字<rt>じ</rt></ruby>を読む")).toEqual({
      text: "漢字を読む",
      ruby: [
        { from: 0, to: 1, text: "かん" },
        { from: 1, to: 2, text: "じ" },
      ],
    })
  })

  it("keeps the styles around a reading, and reads entities in it", () => {
    expect(
      styledText("<c.yellow><ruby>東京<rp>(</rp><rt>とう&amp;きょう</rt><rp>)</rp></ruby>へ</c>"),
    ).toEqual({
      text: "東京へ",
      styles: [{ color: "#ffff00", from: 0, to: 3 }],
      ruby: [{ from: 0, to: 2, text: "とう&きょう" }],
    })
  })

  it("counts characters past U+FFFF as strings do, two each", () => {
    expect(styledText("<c.yellow><ruby>𠮷<rt>よし</rt></ruby>野家</c>")).toEqual({
      text: "𠮷野家",
      styles: [{ color: "#ffff00", from: 0, to: 4 }],
      ruby: [{ from: 0, to: 2, text: "よし" }],
    })
  })

  it("counts a reading from where tidied spaces leave its characters", () => {
    expect(styledText("  Ich  <ruby>lese<rt>reading</rt></ruby>")).toEqual({
      text: "Ich lese",
      ruby: [{ from: 4, to: 8, text: "reading" }],
    })
  })
})
