import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { cueAt, cuesOf, MAX_WIDTH, width, type Cue } from "./cues"
import { parseJson3, type Json3 } from "./json3"

type Seg = { utf8: string; tOffsetMs?: number; isSpeakerChange?: number }

/** Auto captions as YouTube sends them: one event per line, each word timed from the line's start. */
const asr = (...lines: Array<Array<[text: string, ms: number, speakerChange?: boolean]>>): Json3 => ({
  events: lines.flatMap((words, index) => {
    const start = words[0]![1]
    const line = {
      tStartMs: start,
      dDurationMs: 5000,
      segs: words.map(([utf8, ms, speakerChange]): Seg => ({
        utf8,
        tOffsetMs: ms - start,
        ...(speakerChange === true && { isSpeakerChange: 1 }),
      })),
    }
    // Each line after the first also comes with the break that rolls the one before it up.
    return index === 0
      ? [line]
      : [{ tStartMs: start, dDurationMs: 0, aAppend: 1, segs: [{ utf8: "\n" }] }, line]
  }),
})

const creator = (...events: Array<[text: string, startMs: number, endMs: number]>): Json3 => ({
  events: events.map(([utf8, startMs, endMs]) => ({
    tStartMs: startMs,
    dDurationMs: endMs - startMs,
    segs: [{ utf8 }],
  })),
})

/** Words spoken 300 ms apart from `startMs`, each with its own spacing, as auto captions give it. */
const spoken = (text: string, startMs = 0): Array<[string, number]> =>
  text.split(/(?= )/u).map((word, index) => [word, startMs + index * 300])

const texts = (cues: ReadonlyArray<Cue>) => cues.map(({ text }) => text)

describe("cuesOf for auto captions", () => {
  it("cuts after a sentence once the cue is long enough", () => {
    const json3 = asr(
      spoken("Eine künstliche Intelligenz gerät außer Kontrolle. Sie löst einen Atomkrieg aus."),
    )
    expect(texts(cuesOf(json3, true))).toEqual([
      "Eine künstliche Intelligenz gerät außer Kontrolle.",
      "Sie löst einen Atomkrieg aus.",
    ])
  })

  it("keeps a short sentence with the next", () => {
    expect(texts(cuesOf(asr(spoken("Hallo. Wie geht es dir heute so?")), true))).toEqual([
      "Hallo. Wie geht es dir heute so?",
    ])
  })

  it("cuts at a speaker change and drops the marker", () => {
    const json3 = asr([
      ["Czy", 0],
      [">> widzowie", 300, true],
      [" znajdź", 600],
    ])
    expect(texts(cuesOf(json3, true))).toEqual(["Czy", "widzowie znajdź"])
  })

  it("cuts at a long pause even in a short cue", () => {
    expect(texts(cuesOf(asr([...spoken("Nie wiem"), ...spoken(" Na lekarstwach", 5000)]), true))).toEqual([
      "Nie wiem",
      "Na lekarstwach",
    ])
  })

  it("cuts at a pause once the cue is long enough", () => {
    const json3 = asr([
      ...spoken("tötet in kurzer Zeit einen großen Teil"),
      ...spoken(" und widmet dann", 4000),
    ])
    expect(texts(cuesOf(json3, true))).toEqual(["tötet in kurzer Zeit einen großen Teil", "und widmet dann"])
  })

  it("puts a space between lines, but not between Japanese ones", () => {
    expect(texts(cuesOf(asr(spoken("gerät völlig"), spoken("außer Kontrolle", 600)), true))).toEqual([
      "gerät völlig außer Kontrolle",
    ])
    const japanese = asr(
      [
        ["今日", 0],
        ["は", 300],
      ],
      [["リレー", 600]],
    )
    expect(texts(cuesOf(japanese, true))).toEqual(["今日はリレー"])
  })

  it("cuts a cue that grows too wide after its clause", () => {
    const json3 = asr(
      spoken(
        "Heute, mehr als 40 Jahre später, warnen einige KI-Forscher vor einem Risiko, das zumindest in einem Punkt an diese Geschichte erinnert",
      ),
    )
    expect(texts(cuesOf(json3, true))).toEqual([
      "Heute, mehr als 40 Jahre später,",
      "warnen einige KI-Forscher vor einem Risiko,",
      "das zumindest in einem Punkt an diese Geschichte erinnert",
    ])
  })

  it("keeps a Japanese particle with its word across a pause", () => {
    const json3 = asr([
      ["こんにちは今日の動画は", 0],
      ["リレー", 300],
      ["に", 2000],
      ["つい", 2100],
      ["て", 2200],
    ])
    expect(texts(cuesOf(json3, true))).toEqual(["こんにちは今日の動画はリレーについて"])
  })

  it("keeps a Japanese compound together across a pause", () => {
    const json3 = asr([
      ["輸入消費税とかの", 0],
      ["経理", 300],
      ["関係", 2000],
    ])
    expect(texts(cuesOf(json3, true))).toEqual(["輸入消費税とかの経理関係"])
  })

  it("ends a polite Japanese sentence", () => {
    const json3 = asr([
      ["今日はリレーについての動画", 0],
      ["です", 300],
      ["制御盤", 600],
    ])
    expect(texts(cuesOf(json3, true))).toEqual(["今日はリレーについての動画です", "制御盤"])
  })

  it("drops sounds and bleeps, cutting where they were", () => {
    const json3 = asr([
      ...spoken("模型を作っていき"),
      [" [音楽]", 900],
      ["ます", 6000],
      ...spoken(" Co to", 7000),
      [" [ __ ]", 7600],
      [" jest", 7900],
    ])
    expect(texts(cuesOf(json3, true))).toEqual(["模型を作っていき", "ます Co to jest"])
  })

  it("shows a cue until the next one, or a while after its last word", () => {
    const json3 = asr([
      ...spoken("Nie wiem, co mam powiedzieć."),
      ...spoken(" Na lekarstwach.", 1500),
      ...spoken(" No tak", 10_000),
    ])
    expect(cuesOf(json3, true).map(({ startMs, endMs }) => [startMs, endMs])).toEqual([
      [0, 1500],
      [1500, 3800],
      [10_000, 12_300],
    ])
  })
})

describe("cuesOf for creator captions", () => {
  it("keeps each cue, joining its lines", () => {
    const json3 = creator(
      [" Sie löst eigenständig \n einen Atomkrieg aus, ", 2960, 5080],
      ["制御盤や\n電気機器", 5200, 8000],
    )
    expect(cuesOf(json3, false)).toEqual([
      { startMs: 2960, endMs: 5080, text: "Sie löst eigenständig einen Atomkrieg aus," },
      { startMs: 5200, endMs: 8000, text: "制御盤や電気機器" },
    ])
  })

  it("drops the padding of no-break spaces", () => {
    expect(texts(cuesOf(creator(["Дуже добре, \nдякую.  ", 0, 1000]), false))).toEqual(["Дуже добре, дякую."])
  })

  it("drops sounds, and cues that only describe one", () => {
    const json3 = creator(
      ["[Music]", 0, 1000],
      ["(Helle Klänge)", 1000, 2000],
      ["♪ Künstliche Intelligenz (KI) ♪", 2000, 3000],
    )
    expect(texts(cuesOf(json3, false))).toEqual(["Künstliche Intelligenz (KI)"])
  })

  it("ends a cue where the next starts", () => {
    const cues = cuesOf(creator(["Raz", 0, 3000], ["Dwa", 2000, 4000]), false)
    expect(cues.map(({ startMs, endMs }) => [startMs, endMs])).toEqual([
      [0, 2000],
      [2000, 4000],
    ])
  })

  it("skips events without text", () => {
    expect(
      cuesOf({ events: [{ tStartMs: 0, dDurationMs: 9000 }, ...creator([" \n ", 0, 1000]).events] }, false),
    ).toEqual([])
  })
})

describe("cuesOf on recorded tracks", () => {
  const directory = new URL("./fixtures/", import.meta.url)
  const tracks = readdirSync(directory).map((name) => ({
    name,
    asr: name.includes(".asr."),
    json3: parseJson3(JSON.parse(readFileSync(new URL(name, directory), "utf8")))!,
  }))
  /** All the letters in a track, to compare without spacing, speaker markers or sounds. */
  const letters = (text: string) => text.replace(/\s|>>|\[[^\]]*\]|♪|\([^)]*\)/gu, "")

  it.each(tracks)("$name shows cues in order, one at a time", ({ json3, asr }) => {
    const cues = cuesOf(json3, asr)
    expect(cues.length).toBeGreaterThan(0)
    for (const [index, cue] of cues.entries()) {
      expect(cue.startMs).toBeLessThan(cue.endMs)
      expect(cue.endMs).toBeLessThanOrEqual(cues[index + 1]?.startMs ?? Infinity)
    }
  })

  it.each(tracks)("$name keeps every word", ({ json3, asr }) => {
    const source = json3.events
      .filter(({ aAppend }) => aAppend !== 1)
      .flatMap(({ segs = [] }) => segs.map(({ utf8 }) => utf8))
      .join("")
    expect(letters(texts(cuesOf(json3, asr)).join(""))).toBe(letters(source))
  })

  it.each(tracks.filter(({ asr }) => asr))("$name fits each cue in two lines", ({ json3 }) => {
    for (const { text } of cuesOf(json3, true)) {
      expect(width(text), text).toBeLessThanOrEqual(MAX_WIDTH)
    }
  })
})

describe("cueAt", () => {
  const cues = cuesOf(creator(["Raz", 0, 1000], ["Dwa", 1000, 2000], ["Trzy", 5000, 6000]), false)

  it("finds the cue showing", () => {
    expect(cueAt(cues, 0)?.text).toBe("Raz")
    expect(cueAt(cues, 1500)?.text).toBe("Dwa")
    expect(cueAt(cues, 5999)?.text).toBe("Trzy")
  })

  it("hands over at the next start", () => {
    expect(cueAt(cues, 1000)?.text).toBe("Dwa")
  })

  it("finds nothing between cues or outside them", () => {
    expect(cueAt(cues, 3000)).toBeUndefined()
    expect(cueAt(cues, -1)).toBeUndefined()
    expect(cueAt(cues, 6000)).toBeUndefined()
    expect(cueAt([], 0)).toBeUndefined()
  })
})
