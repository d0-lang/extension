import { describe, expect, it } from "vitest"
import { entriesForLemma, isValidSplit, linkSense, splitBySegments } from "./entries"

const entry = (lemma: string, senses: Array<{ translations: Array<string>; see?: Array<string> }>, pos = "NOUN") => ({
  lemma,
  pos,
  senses,
})

const links = (text: string, see: Array<string>) =>
  linkSense(text, see).parts.flatMap(({ target }) => (target === undefined ? [] : [target]))

describe("entriesForLemma", () => {
  it("drops other lemmas and ignores case", () => {
    const entries = [entry("mat", []), entry("Mata", [], "PROPN"), entry("mata", []), entry("matać", [], "VERB")]
    expect(entriesForLemma(entries, "mata").map(({ lemma }) => lemma)).toEqual(["Mata", "mata"])
  })

  it("can leave nothing", () => {
    expect(entriesForLemma([entry("mat", [])], "mata")).toEqual([])
  })
})

describe("linkSense", () => {
  it("leaves text without see as one part", () => {
    expect(linkSense("king [chess]", [])).toEqual({
      parts: [{ text: "king [chess]", target: undefined }],
      unfound: [],
    })
  })

  it("finds a target inside a merged sense", () => {
    expect(linkSense("king; synonym of państwo; queen", ["państwo"])).toEqual({
      parts: [
        { text: "king; synonym of ", target: undefined },
        { text: "państwo", target: "państwo" },
        { text: "; queen", target: undefined },
      ],
      unfound: [],
    })
  })

  it("finds two targets split by a slash", () => {
    const { parts, unfound } = linkSense("synonym of zwyczajny /ordynarny", ["zwyczajny", "ordynarny"])
    expect(parts.map(({ text }) => text).join("")).toBe("synonym of zwyczajny /ordynarny")
    expect(parts.flatMap(({ target }) => target ?? [])).toEqual(["zwyczajny", "ordynarny"])
    expect(unfound).toEqual([])
  })

  it("does not match inside a longer word, including next to a non-ASCII letter", () => {
    expect(links("synonym of matka", ["mat", "x"])).toEqual([])
    expect(links("państwo", ["pa", "x"])).toEqual([])
    expect(links("państwo", ["stwo", "x"])).toEqual([])
  })

  it("links the whole text when its only target is not in it", () => {
    expect(linkSense("synonym of rodzice", ["rodzic"])).toEqual({
      parts: [{ text: "synonym of rodzice", target: "rodzic" }],
      unfound: [],
    })
  })

  it("returns missing targets when there are several", () => {
    expect(linkSense("synonym of zwyczajny", ["zwyczajny", "ordynarny"])).toEqual({
      parts: [
        { text: "synonym of ", target: undefined },
        { text: "zwyczajny", target: "zwyczajny" },
      ],
      unfound: ["ordynarny"],
    })
  })

  it("links every occurrence", () => {
    expect(links("synonym of dziób (a); synonym of dziób (b)", ["dziób"])).toEqual(["dziób", "dziób"])
  })

  it("links with the see spelling when the text differs in case", () => {
    expect(linkSense("Państwo", ["państwo"]).parts).toEqual([{ text: "Państwo", target: "państwo" }])
  })

  it("matches multi-word targets across any separator", () => {
    expect(links("synonym of wychodzić za mąż (“to marry”)", ["wychodzić za mąż"])).toEqual(["wychodzić za mąż"])
    expect(linkSense("synonym of śmigus-dyngus", ["śmigus-dyngus"]).parts).toEqual([
      { text: "synonym of ", target: undefined },
      { text: "śmigus-dyngus", target: "śmigus-dyngus" },
    ])
  })

  it("matches multi-word targets, longest first", () => {
    expect(links("synonym of mimo to", ["mimo", "mimo to"])).toEqual(["mimo to"])
    expect(linkSense("synonym of mimo to", ["mimo", "mimo to"]).unfound).toEqual(["mimo"])
  })

  it("treats punctuation in a target as a separator", () => {
    expect(links("see a.b and axb", ["a.b"])).toEqual(["a.b"])
  })

  it("ignores blank and repeated targets", () => {
    expect(linkSense("text", ["", " ", "-", "x", "X"]).parts).toEqual([{ text: "text", target: "x" }])
  })
})

describe("isValidSplit", () => {
  const segments = [{ text: "Arbeit", entries: [0] }, { text: "s" }, { text: "amt", entries: [1, 2] }]

  it("accepts a split that spells the word", () => {
    expect(isValidSplit(segments, "Arbeitsamt", 3)).toBe(true)
  })

  it("rejects texts that do not join to the word as sent", () => {
    expect(isValidSplit(segments, "arbeitsamt", 3)).toBe(false)
  })

  it("rejects an index out of range or claimed twice", () => {
    expect(isValidSplit(segments, "Arbeitsamt", 2)).toBe(false)
    expect(isValidSplit([{ text: "ab", entries: [0] }, { text: "c", entries: [0] }], "abc", 1)).toBe(false)
  })
})

describe("splitBySegments", () => {
  it("puts entries in no segment first, for the whole word", () => {
    const entries = [entry("Arbeitsamt", []), entry("Arbeit", []), entry("Amt", [])]
    const { whole, parts } = splitBySegments(entries, [
      { text: "Arbeit", entries: [1] },
      { text: "s" },
      { text: "amt", entries: [2] },
    ])
    expect(whole.map(({ lemma }) => lemma)).toEqual(["Arbeitsamt"])
    expect(parts.map(({ text, entries }) => [text, entries.map(({ lemma }) => lemma)])).toEqual([
      ["Arbeit", ["Arbeit"]],
      ["s", []],
      ["amt", ["Amt"]],
    ])
  })
})
