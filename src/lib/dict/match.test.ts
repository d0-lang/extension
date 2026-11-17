import { describe, expect, it } from "vitest"
import { collapseWhitespace, copyNumber, excerptAround, placeMatch } from "./match"

describe("collapseWhitespace", () => {
  it("collapses and trims, keeping where each character came from", () => {
    const { text, rawIndex } = collapseWhitespace("  Er  fand\n gestern ")
    expect(text).toBe("Er fand gestern")
    expect(rawIndex[text.indexOf("fand")]).toBe(6)
    expect(rawIndex[text.indexOf("gestern")]).toBe(12)
  })
})

describe("copyNumber", () => {
  it("counts copies from 1, those inside longer words too", () => {
    const text = "Шли на восток и северо-восток."
    expect(copyNumber(text, "восток", text.indexOf("восток"))).toBe(1)
    expect(copyNumber(text, "восток", text.lastIndexOf("восток"))).toBe(2)
    expect(copyNumber(text, "восток", 0)).toBeUndefined()
  })
})

describe("placeMatch", () => {
  const text = "Тебе надо держать все время ухо востро, пока ты в этом городе."

  it("places the parts in order around the click", () => {
    const spans = placeMatch(text, ["держать", "ухо востро"], text.indexOf("ухо"))
    expect(spans?.map(([start, end]) => text.slice(start, end))).toEqual(["держать", "ухо востро"])
  })

  it("anchors on the clicked copy when a part occurs twice", () => {
    const twice = "Er fand nichts, und er fand gestern statt."
    const spans = placeMatch(twice, ["fand", "statt"], twice.lastIndexOf("fand"))
    expect(spans?.[0]?.[0]).toBe(twice.lastIndexOf("fand"))
  })

  it("gives up when the parts don't fit around the click", () => {
    expect(placeMatch(text, ["ухо востро", "держать"], text.indexOf("ухо"))).toBeUndefined()
  })
})

describe("excerptAround", () => {
  const cut = (text: string, word: string, max: number) => {
    const start = text.indexOf(word)
    const span = excerptAround(text, start, start + word.length, max)
    return span === undefined ? undefined : text.slice(...span)
  }

  it("keeps a sentence within the limit whole", () => {
    expect(cut("Hola, mundo.", "mundo", 20)).toBe("Hola, mundo.")
  })

  it("sends the clause around the word, with whole clauses on either side while they fit", () => {
    const text = "Primero vino el agua, así como un plan de reformas, y después todo lo demás."
    expect(cut(text, "como", 40)).toBe("así como un plan de reformas,")
    expect(cut(text, "como", 52)).toBe("Primero vino el agua, así como un plan de reformas,")
    expect(cut(text, "agua", 30)).toBe("Primero vino el agua,")
  })

  it("cuts at semicolons, colons and spaced dashes too", () => {
    expect(cut("uno dos; tres cuatro: cinco seis — siete ocho", "cinco", 12)).toBe("cinco seis")
  })

  it("sends the words around the word when its clause is too long", () => {
    // One word right, then one left, while they fit.
    expect(cut("uno dos tres cuatro cinco seis siete", "cuatro", 18)).toBe("tres cuatro cinco")
  })

  it("sends nothing when the word itself is too long", () => {
    expect(cut("Donaudampfschifffahrt fährt.", "Donaudampfschifffahrt", 10)).toBeUndefined()
  })
})
