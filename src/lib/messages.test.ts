import { describe, expect, it } from "vitest"
import { fromUnknown } from "./dict/errors"
import { reportLanguage, type LookupReply } from "./messages"

const reply = (lang: string | undefined, entries: number): LookupReply => ({
  ok: true,
  languages: ["fr_en", "de_en"],
  paused: [],
  tried: ["de_en", "fr_en"],
  lang,
  server: lang === undefined ? undefined : "https://dict.example",
  sources: [],
  labels: {},
  entries: Array.from({ length: entries }, () => ({ lemma: "va", pos: "VERB", senses: [] })),
})

describe("reportLanguage", () => {
  it("is the language that answered", () => {
    expect(reportLanguage(reply("fr_en", 1))).toBe("fr_en")
  })

  it("is the language ranked first when none answered, so a missing word can be reported", () => {
    expect(reportLanguage(reply(undefined, 0))).toBe("de_en")
  })

  it("is unset when the lookup failed", () => {
    expect(
      reportLanguage({ ok: false, languages: [], paused: [], tried: [], error: fromUnknown("offline") }),
    ).toBeUndefined()
  })
})
