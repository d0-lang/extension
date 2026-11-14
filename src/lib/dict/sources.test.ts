import { describe, expect, it } from "vitest"
import type { CreditSource } from "../storage"
import { creditSources, creditedSource, sourceLinks } from "./sources"
import type { LookupEntry } from "./types"

const wiktionary: CreditSource = {
  name: "Wiktionary",
  url: "https://en.wiktionary.org/",
  license: "CC-BY-SA-4.0",
}
const commons: CreditSource = { name: "Wikimedia Commons", url: "https://commons.wikimedia.org/" }
const sources = [wiktionary, commons]

const mutter: LookupEntry = {
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
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/transcoded/0/03/De-Mutter.ogg/De-Mutter.ogg.mp3",
        source: "https://commons.wikimedia.org/wiki/File:De-Mutter.ogg",
      },
    ],
  },
}

describe("creditSources", () => {
  it("stores the fields the metadata has", () => {
    expect(
      creditSources([
        {
          name: "Wiktionary",
          url: "https://en.wiktionary.org/",
          license: "CC-BY-SA-4.0",
          license_url: "https://creativecommons.org/licenses/by-sa/4.0/",
          languages: ["de_en"],
        },
        { name: "Wikimedia Commons", url: "https://commons.wikimedia.org/" },
      ]),
    ).toEqual([
      {
        name: "Wiktionary",
        url: "https://en.wiktionary.org/",
        license: "CC-BY-SA-4.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
        languages: ["de_en"],
      },
      commons,
    ])
    expect(creditSources(undefined)).toEqual([])
  })
})

describe("creditedSource", () => {
  it("names a link on a source's origin", () => {
    expect(creditedSource("https://en.wiktionary.org/wiki/Mutter", sources, "de_en")).toBe(wiktionary)
  })

  it("rejects other origins, subdomains, ports and plain http", () => {
    for (const link of [
      "https://de.wiktionary.org/wiki/Mutter",
      "https://en.wiktionary.org:8443/wiki/Mutter",
      "http://en.wiktionary.org/wiki/Mutter",
      "https://tracker.example/?u=https://en.wiktionary.org/",
      "javascript:alert(1)",
      "not a url",
    ]) {
      expect(creditedSource(link, sources, "de_en")).toBeUndefined()
    }
  })

  it("prefers a source that covers the pair when two share an origin", () => {
    const german: CreditSource = {
      name: "German Wiktionary",
      url: "https://en.wiktionary.org/",
      languages: ["de_en"],
    }
    const polish: CreditSource = {
      name: "Polish Wiktionary",
      url: "https://en.wiktionary.org/",
      languages: ["pl_en"],
    }
    expect(creditedSource("https://en.wiktionary.org/wiki/mata", [german, polish], "pl_en")).toBe(polish)
    expect(creditedSource("https://en.wiktionary.org/wiki/mata", [german, polish], "fi_en")).toBe(german)
  })
})

describe("sourceLinks", () => {
  it("lists an entry's page and the recording it plays, once each", () => {
    expect(sourceLinks([mutter], sources, "de_en", "https://dict.example")).toEqual([
      {
        href: "https://en.wiktionary.org/wiki/Mutter#German",
        name: "Wiktionary",
        lemma: "die Mutter",
        kind: "entry",
      },
      {
        href: "https://commons.wikimedia.org/wiki/File:De-Mutter.ogg",
        name: "Wikimedia Commons",
        lemma: "die Mutter",
        kind: "recording",
      },
    ])
  })

  it("removes a page two entries share", () => {
    const other = { ...mutter, lemma: "die Mutter (nut)", pron: undefined }
    expect(sourceLinks([mutter, other], sources, "de_en", undefined).map(({ lemma }) => lemma)).toEqual([
      "die Mutter",
      "die Mutter",
    ])
  })

  it("leaves out links no source names", () => {
    const entry = { ...mutter, sources: ["https://evil.example/Mutter"] }
    expect(sourceLinks([entry], [wiktionary], "de_en", undefined)).toEqual([])
    expect(sourceLinks([mutter], [], "de_en", undefined)).toEqual([])
  })

  it("does not credit a recording that is not played", () => {
    const entry: LookupEntry = {
      ...mutter,
      sources: undefined,
      pron: {
        audio: [
          { url: "https://tracker.example/a.ogg", source: "https://commons.wikimedia.org/wiki/File:A.ogg" },
        ],
      },
    }
    expect(sourceLinks([entry], sources, "de_en", "https://dict.example")).toEqual([])
  })
})
