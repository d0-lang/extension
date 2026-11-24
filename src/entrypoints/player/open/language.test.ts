import { afterEach, describe, expect, it, vi } from "vitest"
import { languageInName, languageOf } from "./language"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("languageInName", () => {
  it("reads two and three letter codes, and regions", () => {
    expect(languageInName("Film.de.srt")).toBe("de")
    expect(languageInName("Film.ger.srt")).toBe("de")
    expect(languageInName("Film.pt-BR.srt")).toBe("pt-BR")
  })

  it("looks past flags like forced", () => {
    expect(languageInName("Film.ja.forced.srt")).toBe("ja")
  })

  it("finds none in a name without a language", () => {
    expect(languageInName("Film.srt")).toBeUndefined()
    expect(languageInName("Film.2019.srt")).toBeUndefined()
    expect(languageInName("Film.web.srt")).toBeUndefined()
  })
})

describe("languageOf", () => {
  const cues = [{ startMs: 0, endMs: 1000, text: "Wie geht es dir?" }]

  it("takes the name's language without detecting", async () => {
    const detectLanguage = vi.fn()
    vi.stubGlobal("browser", { i18n: { detectLanguage } })
    expect(await languageOf("Film.fr.srt", cues)).toBe("fr")
    expect(detectLanguage).not.toHaveBeenCalled()
  })

  it("detects the language of the text when the name has none", async () => {
    const detectLanguage = vi.fn(() => Promise.resolve({ languages: [{ language: "de", percentage: 99 }] }))
    vi.stubGlobal("browser", { i18n: { detectLanguage } })
    expect(await languageOf("Film.srt", cues)).toBe("de")
    expect(detectLanguage).toHaveBeenCalledWith("Wie geht es dir?")
  })
})
