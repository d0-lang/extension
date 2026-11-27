import { describe, expect, it } from "vitest"
import type { LookupEntry } from "$lib/dict/types"
import type { CardSeed } from "$lib/storage"
import { boldSpans, draftSentence, markedHtml, markedSentence, noteFields } from "./fields"

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

describe("markedSentence", () => {
  it("marks the bold parts, and cuts a long sentence around them", () => {
    const text = `${"Lorem ipsum dolor, ".repeat(10)}hier wird gefunden, ${"sit amet consectetur, ".repeat(10)}`
    const start = text.indexOf("gefunden")
    const marked = markedSentence(text, [[start, start + "gefunden".length]])
    expect(marked).toMatch(/^….*hier wird \*\*gefunden\*\*.*…$/)
    expect(marked.length).toBeLessThan(text.length)
  })
})

describe("markedHtml", () => {
  it("bolds between pairs of ** and escapes the rest, keeping a lone ** as typed", () => {
    expect(markedHtml("a <x> **b** c **d")).toBe("a &lt;x&gt; <b>b</b> c **d")
  })

  it("bolds the whole Arabic word when the bold cuts it, so its letters stay joined", () => {
    expect(markedHtml("قرأت ال**كتاب** أمس")).toBe("قرأت <b>الكتاب</b> أمس")
    expect(markedHtml("قرأت **كتاب**ها أمس")).toBe("قرأت <b>كتابها</b> أمس")
    // Kasra is a mark Arabic shares with other scripts.
    expect(markedHtml("بِ**كتاب**")).toBe("<b>بِكتاب</b>")
    // Adlam's letters each take two code units.
    expect(markedHtml("\u{1E900}**\u{1E901}**\u{1E902}")).toBe("<b>\u{1E900}\u{1E901}\u{1E902}</b>")
    // A zero width joiner joins across the edge, and a non-joiner keeps the letters apart.
    expect(markedHtml("ب\u200D**ت**")).toBe("<b>ب\u200Dت</b>")
    expect(markedHtml("ب\u200C**ت**")).toBe("ب\u200C<b>ت</b>")
  })

  it("keeps a bold part of a word in scripts whose letters do not join", () => {
    expect(markedHtml("Rettungs**fonds**")).toBe("Rettungs<b>fonds</b>")
    expect(markedHtml("קראתי את ה**ספר**")).toBe("קראתי את ה<b>ספר</b>")
  })
})

describe("draftSentence", () => {
  it("starts from the sentence around the word, and keeps the user's edit once there is one", () => {
    const draft = { entry: 0, senses: [] }
    expect(draftSentence(seed(), draft)).toBe("Der Film **fängt** um acht Uhr **an**.")
    expect(draftSentence(seed(), { ...draft, sentence: "**fängt** … **an**" })).toBe("**fängt** … **an**")
    expect(draftSentence(seed({ sentence: undefined }), draft)).toBe("")
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

  it("takes edited senses and sentence, and leaves out a sense edited to nothing", () => {
    const fields = noteFields(
      seed(),
      { entry: 0, senses: [0, 1], glosses: { "0": "to begin", "1": " " }, sentence: "Er **fängt** an." },
      false,
    )!
    expect(fields.Meaning).toBe("<p>to begin</p>")
    expect(fields.Sentence).toBe("Er <b>fängt</b> an.")
    expect(fields.Pronunciation).toBe("")
  })

  it("names a page Anki cannot open without linking it", () => {
    const page = { url: "chrome-extension://x/player.html", title: "clip.mkv" }
    expect(noteFields(seed({ page }), { entry: 0, senses: [0] }, true)!.Source).toBe("clip.mkv")
  })
})
