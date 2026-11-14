import { describe, expect, it } from "vitest"
import { LEGAL_CHANGE_MAX, SOURCE_TEXT_MAX, lookupResultSchema, serverMetaSchema } from "./schemas"

const body = (sense: object) => ({ entries: [{ lemma: "mata", pos: "NOUN", senses: [sense] }] })

describe("lookupResultSchema", () => {
  it("keeps see", () => {
    const parsed = lookupResultSchema.parse(body({ glosses: ["synonym of matka"], see: ["matka"] }))
    expect(parsed.entries[0]?.senses[0]?.see).toEqual(["matka"])
  })

  it("keeps segments", () => {
    const parsed = lookupResultSchema.parse({
      ...body({ glosses: ["in"] }),
      segments: [{ text: "ssa", entries: [0] }],
    })
    expect(parsed.segments).toEqual([{ text: "ssa", entries: [0] }])
  })

  it("drops malformed segments but keeps the entries", () => {
    const parsed = lookupResultSchema.parse({
      ...body({ glosses: ["in"] }),
      segments: [{ text: "ssa", entries: [-1] }],
    })
    expect(parsed.segments).toBeUndefined()
    expect(parsed.entries).toHaveLength(1)
  })

  it("accepts a sense without see", () => {
    const parsed = lookupResultSchema.parse(body({ glosses: ["mat (floor pad)"] }))
    expect(parsed.entries[0]?.senses[0]).toEqual({ glosses: ["mat (floor pad)"] })
  })

  it("keeps a definition as one gloss", () => {
    const definition = "Eine weibliche Person, die ein Kind geboren hat oder es großzieht."
    const parsed = lookupResultSchema.parse(body({ glosses: [definition] }))
    expect(parsed.entries[0]?.senses[0]?.glosses).toEqual([definition])
  })

  it("rejects a sense with translations instead of glosses", () => {
    expect(lookupResultSchema.safeParse(body({ translations: ["mat"] })).success).toBe(false)
  })

  it("keeps sources and audio objects", () => {
    const entry = {
      lemma: "die Mutter",
      pos: "NOUN",
      senses: [{ glosses: ["mother"] }],
      sources: ["https://en.wiktionary.org/wiki/Mutter#German"],
      pron: {
        audio: [
          {
            url: "https://upload.wikimedia.org/wikipedia/commons/0/03/De-Mutter.ogg",
            source: "https://commons.wikimedia.org/wiki/File:De-Mutter.ogg",
          },
          { url: "https://upload.wikimedia.org/wikipedia/commons/0/03/De-Mutter.mp3" },
        ],
      },
    }
    expect(lookupResultSchema.parse({ entries: [entry] }).entries[0]).toEqual(entry)
  })

  it("drops audio given as strings, and malformed sources, without the entry", () => {
    const [entry] = lookupResultSchema.parse({
      entries: [
        {
          lemma: "die Mutter",
          pos: "NOUN",
          senses: [{ glosses: ["mother"] }],
          sources: "https://en.wiktionary.org/wiki/Mutter",
          pron: { ipa: ["/ˈmʊtər/"], audio: ["https://upload.wikimedia.org/a.ogg"] },
        },
      ],
    }).entries
    expect(entry?.pron).toEqual({ ipa: ["/ˈmʊtər/"] })
    expect(entry?.sources).toBeUndefined()
  })

  it("keeps labels and match, and drops malformed ones without the entry", () => {
    const entry = {
      lemma: "держа́ть у́хо востро́",
      pos: "VERB",
      labels: ["impf"],
      senses: [{ glosses: ["to keep an eye peeled"] }],
      match: ["держать", "ухо востро"],
    }
    expect(lookupResultSchema.parse({ entries: [entry] }).entries[0]).toEqual(entry)
    const [broken] = lookupResultSchema.parse({ entries: [{ ...entry, labels: "impf", match: [] }] }).entries
    expect(broken?.labels).toBeUndefined()
    expect(broken?.match).toBeUndefined()
    expect(broken?.lemma).toBe(entry.lemma)
  })
})

describe("serverMetaSchema legal", () => {
  const meta = { name: "dict", nonce: "n" }
  const legal = {
    privacy_link: "https://dict.example/privacy",
    privacy_hash: "a".repeat(64),
    privacy_change: "Lookups are now kept for 30 days.",
    tos_link: "https://dict.example/tos",
    tos_hash: "b".repeat(64),
  }

  it("keeps the policies", () => {
    expect(serverMetaSchema.parse({ ...meta, legal }).legal).toEqual(legal)
  })

  it("treats a malformed section as none", () => {
    expect(serverMetaSchema.parse({ ...meta, legal: { ...legal, tos_hash: "short" } }).legal).toBeUndefined()
    expect(
      serverMetaSchema.parse({ ...meta, legal: { ...legal, tos_hash: "B".repeat(64) } }).legal,
    ).toBeUndefined()
    expect(
      serverMetaSchema.parse({ ...meta, legal: { ...legal, tos_link: "javascript:alert(1)" } }).legal,
    ).toBeUndefined()
  })

  it("drops an overlong change summary but keeps the policies", () => {
    const parsed = serverMetaSchema.parse({
      ...meta,
      legal: { ...legal, privacy_change: "x".repeat(LEGAL_CHANGE_MAX + 1) },
    })
    expect(parsed.legal?.privacy_change).toBeUndefined()
    expect(parsed.legal?.privacy_hash).toBe(legal.privacy_hash)
  })
})

describe("serverMetaSchema sources", () => {
  const meta = { name: "dict", nonce: "n" }
  const wiktionary = {
    name: "Wiktionary",
    url: "https://en.wiktionary.org/",
    license: "CC-BY-SA-4.0",
    license_url: "https://creativecommons.org/licenses/by-sa/4.0/",
    languages: ["de_en"],
  }
  const commons = { name: "Wikimedia Commons", url: "https://commons.wikimedia.org/" }

  it("keeps the sources, and none is unset", () => {
    expect(serverMetaSchema.parse({ ...meta, sources: [wiktionary, commons] }).sources).toEqual([
      wiktionary,
      commons,
    ])
    expect(serverMetaSchema.parse(meta).sources).toBeUndefined()
  })

  it("drops a malformed source but keeps the others and the metadata", () => {
    const parsed = serverMetaSchema.parse({
      ...meta,
      sources: [
        { ...commons, name: "x".repeat(SOURCE_TEXT_MAX + 1) },
        { ...commons, url: "http://commons.wikimedia.org/" },
        { ...commons, languages: ["__proto__"] },
        "Wiktionary",
        wiktionary,
      ],
    })
    expect(parsed.sources).toEqual([wiktionary])
    expect(parsed.name).toBe("dict")
  })

  it("drops a bad licence but keeps the credit", () => {
    const parsed = serverMetaSchema.parse({
      ...meta,
      sources: [
        { ...wiktionary, license: "x".repeat(SOURCE_TEXT_MAX + 1), license_url: "javascript:alert(1)" },
      ],
    })
    expect(parsed.sources).toEqual([
      { name: "Wiktionary", url: "https://en.wiktionary.org/", languages: ["de_en"] },
    ])
  })

  it("treats a list that is not one as none", () => {
    expect(serverMetaSchema.parse({ ...meta, sources: "Wiktionary" }).sources).toBeUndefined()
  })
})
