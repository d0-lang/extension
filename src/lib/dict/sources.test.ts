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

  it("counts only a source that covers the pair", () => {
    const german: CreditSource = { ...wiktionary, languages: ["de_en"] }
    expect(creditedSource("https://en.wiktionary.org/wiki/Mutter", [german], "de_en")).toBe(german)
    expect(creditedSource("https://en.wiktionary.org/wiki/pies", [german], "pl_en")).toBeUndefined()
    expect(creditedSource("https://en.wiktionary.org/wiki/pies", [german, wiktionary], "pl_en")).toBe(
      wiktionary,
    )
    expect(creditedSource("https://en.wiktionary.org/wiki/pies", [german], undefined)).toBeUndefined()
  })
})

describe("sourceLinks", () => {
  it("lists an entry's page and its recording, once each", () => {
    expect(sourceLinks([mutter], sources, "de_en")).toEqual([
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
        recording: undefined,
      },
    ])
  })

  it("lists every recording sent, numbered when there are several", () => {
    const entry: LookupEntry = {
      ...mutter,
      sources: undefined,
      pron: {
        audio: [
          ...(mutter.pron?.audio ?? []),
          // Not a host the client plays from, but it was sent, so it is credited.
          {
            url: "https://tracker.example/De-Mutter3.ogg",
            source: "https://commons.wikimedia.org/wiki/File:De-Mutter3.ogg",
          },
          { url: "https://upload.wikimedia.org/c.ogg" },
        ],
      },
    }
    expect(sourceLinks([entry], sources, "de_en").map(({ href, ...link }) => link)).toEqual([
      { name: "Wikimedia Commons", lemma: "die Mutter", kind: "recording", recording: 1 },
      { name: "Wikimedia Commons", lemma: "die Mutter", kind: "recording", recording: 2 },
    ])
  })

  it("removes a page or recording two entries share", () => {
    const other = { ...mutter, lemma: "Mutter", pos: "PROPN" }
    expect(
      sourceLinks([mutter, other], sources, "de_en").map(({ lemma, kind }) => `${lemma} ${kind}`),
    ).toEqual(["die Mutter entry", "die Mutter recording"])
  })

  it("leaves out links no source names", () => {
    const entry = { ...mutter, sources: ["https://evil.example/Mutter"] }
    expect(sourceLinks([entry], [wiktionary], "de_en")).toEqual([])
    expect(sourceLinks([mutter], [], "de_en")).toEqual([])
  })

  it("leaves out links whose source does not cover the pair", () => {
    expect(
      sourceLinks([mutter], [{ ...wiktionary, languages: ["pl_en"] }, commons], "de_en").map(
        ({ kind }) => kind,
      ),
    ).toEqual(["recording"])
  })
})
