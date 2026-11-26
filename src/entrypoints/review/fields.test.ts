import { describe, expect, it } from "vitest"
import type { LookupEntry } from "$lib/dict/types"
import type { CardSeed } from "$lib/storage"
import { boldSpans, noteFields, sentenceHtml } from "./fields"

const entry = (lemma: string, extra: Partial<LookupEntry> = {}): LookupEntry => ({
  lemma,
  pos: "VERB",
  senses: [{ glosses: ["to begin", "to commence"] }, { glosses: ["to start"] }, { glosses: ["to <do>"] }],
  ...extra,
})

const seed = (extra: Partial<CardSeed> = {}): CardSeed => ({
  id: "1",
  added: 0,
  word: "fängt",
  lang: "de_en",
  server: "https://dict.example",
  entries: [entry("anfangen", { match: ["fängt", "an"], pron: { ipa: ["/ˈanˌfaŋən/", "[x]"] } })],
  entry: 0,
  sentence: { text: "Der Film fängt um acht Uhr an.", at: 1 },
  page: { url: "https://kino.example/film", title: "Kino" },
  ...extra,
})

describe("boldSpans", () => {
  it("bolds every part a separable verb's match names", () => {
    const text = "Der Film fängt um acht Uhr an."
    expect(boldSpans({ text, at: 1 }, "fängt", entry("anfangen", { match: ["fängt", "an"] }))).toEqual([
      [9, 14],
      [27, 29],
    ])
  })

  it("bolds the clicked copy of the word for an entry without a match", () => {
    expect(boldSpans({ text: "es war, was es war", at: 2 }, "war", entry("sein"))).toEqual([[15, 18]])
  })
})

describe("sentenceHtml", () => {
  it("escapes the text and cuts a long sentence around the bold part", () => {
    const text = `${"Lorem ipsum dolor, ".repeat(10)}<b> wird gefunden, ${"sit amet consectetur, ".repeat(10)}`
    const start = text.indexOf("gefunden")
    const html = sentenceHtml(text, [[start, start + "gefunden".length]])
    expect(html).toMatch(/^….*&lt;b&gt; wird <b>gefunden<\/b>.*…$/)
    expect(html.length).toBeLessThan(text.length)
  })
})

describe("noteFields", () => {
  it("writes the picked senses in order, the first IPA, and a link to the page", () => {
    const fields = noteFields(seed(), { entry: 0, senses: [0, 2] }, true)!
    expect(fields.Meaning).toBe("<ol><li>to begin; to commence</li><li>to &lt;do&gt;</li></ol>")
    expect(fields.Sentence).toBe("Der Film <b>fängt</b> um acht Uhr <b>an</b>.")
    expect(fields.Pronunciation).toBe("/ˈanˌfaŋən/")
    expect(fields["Part of speech"]).toBe("verb")
    expect(fields.Source).toBe('<a href="https://kino.example/film">Kino</a>')
  })

  it("writes one sense as a paragraph, and leaves IPA out when the language has it off", () => {
    const fields = noteFields(seed(), { entry: 0, senses: [1] }, false)!
    expect(fields.Meaning).toBe("<p>to start</p>")
    expect(fields.Pronunciation).toBe("")
  })

  it("names a page Anki cannot open without linking it", () => {
    const fields = noteFields(
      seed({ page: { url: "chrome-extension://x/player.html", title: "clip.mkv" } }),
      {
        entry: 0,
        senses: [0],
      },
      true,
    )!
    expect(fields.Source).toBe("clip.mkv")
  })
})
