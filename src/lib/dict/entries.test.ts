import { describe, expect, it } from "vitest"
import { entriesForLemma, groupEntries, linkSense } from "./entries"

const entry = (lemma: string, senses: Array<{ translations: Array<string>; see?: Array<string> }>, pos = "NOUN") => ({
  lemma,
  pos,
  senses,
})

const links = (text: string, see: Array<string>) =>
  linkSense(text, see).parts.flatMap(({ target }) => (target === undefined ? [] : [target]))

describe("groupEntries", () => {
  it("keeps see on each sense of a merged group", () => {
    const [group] = groupEntries([
      entry("mata", [{ translations: ["mat (floor pad)"] }]),
      entry("mata", [{ translations: ["synonym of matka"], see: ["matka"] }]),
    ])
    expect(group?.senses).toEqual([
      { translations: ["mat (floor pad)"] },
      { translations: ["synonym of matka"], see: ["matka"] },
    ])
  })
})

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
    expect(linkSense("synonym of matka", ["mat"]).unfound).toEqual(["mat"])
    expect(links("synonym of matka", ["mat"])).toEqual([])
    expect(links("państwo", ["pa"])).toEqual([])
    expect(links("państwo", ["stwo"])).toEqual([])
  })

  it("appends a target that is not in the text", () => {
    expect(linkSense("synonym of rodzice", ["rodzic"])).toEqual({
      parts: [{ text: "synonym of rodzice", target: undefined }],
      unfound: ["rodzic"],
    })
  })

  it("links every occurrence", () => {
    expect(links("synonym of dziób (a); synonym of dziób (b)", ["dziób"])).toEqual(["dziób", "dziób"])
  })

  it("links with the see spelling when the text differs in case", () => {
    expect(linkSense("Państwo", ["państwo"]).parts).toEqual([{ text: "Państwo", target: "państwo" }])
  })

  it("matches multi-word targets, longest first", () => {
    expect(links("synonym of mimo to", ["mimo", "mimo to"])).toEqual(["mimo to"])
    expect(linkSense("synonym of mimo to", ["mimo", "mimo to"]).unfound).toEqual(["mimo"])
  })

  it("treats regex characters literally", () => {
    expect(links("see a.b and axb", ["a.b"])).toEqual(["a.b"])
  })

  it("ignores blank and repeated targets", () => {
    expect(linkSense("text", ["", " ", "x", "x"]).unfound).toEqual(["x"])
  })
})
