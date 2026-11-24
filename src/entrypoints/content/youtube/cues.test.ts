import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { cueAt, cuesOf, isFast, LINE_WIDTH, shownAt, width, type Cue } from "./cues"
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
    const json3 = asr(spoken("Die Intelligenz gerät außer Kontrolle. Sie löst einen Atomkrieg aus."))
    expect(texts(cuesOf(json3, true))).toEqual([
      "Die Intelligenz gerät außer Kontrolle.",
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

  it("keeps a short word with the word after it across a pause", () => {
    const json3 = asr([...spoken("il a pris le dernier train de la"), ...spoken(" nuit", 4000)])
    expect(texts(cuesOf(json3, true))).toEqual(["il a pris le dernier train de la nuit"])
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

  it("puts no space after a Japanese line of one character", () => {
    expect(texts(cuesOf(asr([["今日", 0]], [["は", 300]], [["晴れ", 600]]), true))).toEqual(["今日は晴れ"])
  })

  it("cuts a cue that grows too wide after its clause", () => {
    const json3 = asr(
      spoken(
        "Heute, mehr als 40 Jahre später, warnen einige KI-Forscher vor einem Risiko, das zumindest in einem Punkt an diese Geschichte erinnert",
      ),
    )
    expect(texts(cuesOf(json3, true))).toEqual([
      "Heute, mehr als 40 Jahre später, warnen\neinige KI-Forscher vor einem Risiko,",
      "das zumindest in einem Punkt\nan diese Geschichte erinnert",
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

  it("keeps a word whole that auto captions cut in two", () => {
    const json3 = asr([
      ["今回の動画ではリレーの仕組みとその", 0],
      ["使い", 300],
      ["方", 2000],
      ["を", 2300],
    ])
    expect(texts(cuesOf(json3, true))).toEqual(["今回の動画ではリレーの仕組みとその使い方を"])
  })

  it("ends a polite Japanese sentence", () => {
    const json3 = asr([
      ["今日はリレーの仕組みについての動画", 0],
      ["です", 300],
      ["制御盤", 600],
    ])
    expect(texts(cuesOf(json3, true))).toEqual(["今日はリレーの仕組みについての動画です", "制御盤"])
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

  it("puts punctuation sent as a piece of its own right after its word, even at a line's start", () => {
    const json3 = asr(
      [
        ["field", 0],
        ["—", 200],
        ["that", 300],
        [" is", 500],
      ],
      [
        [",", 700],
        [" in", 800],
        [" short", 1000],
      ],
    )
    expect(texts(cuesOf(json3, true))).toEqual(["field—that is, in short"])
  })

  it("keeps punctuation with its word across a pause", () => {
    const json3 = asr([...spoken("Quick recipes and simple ingredients"), [".", 3000]])
    expect(texts(cuesOf(json3, true))).toEqual(["Quick recipes and simple ingredients."])
  })

  it("shows a cue until the next one, or a while after its last word", () => {
    const json3 = asr([
      ...spoken("Nie wiem, co mam teraz na to powiedzieć."),
      ...spoken(" Na lekarstwach.", 2400),
      ...spoken(" No tak", 10_000),
    ])
    expect(cuesOf(json3, true).map(({ startMs, endMs }) => [startMs, endMs])).toEqual([
      [0, 2400],
      [2400, 4700],
      [10_000, 12_300],
    ])
  })
})

describe("cuesOf for auto captions without word timings", () => {
  it("puts each of YouTube's cues on one line, until the next", () => {
    const json3 = creator(
      ["Ala ma kota, a kot\nma Alę.", 0, 5000],
      ["Psy biegają\ncały dzień", 3000, 8000],
      ["今日は\nいい天気", 8000, 9000],
    )
    expect(cuesOf(json3, true)).toEqual([
      { startMs: 0, endMs: 3000, text: "Ala ma kota, a kot ma Alę." },
      { startMs: 3000, endMs: 8000, text: "Psy biegają cały dzień" },
      { startMs: 8000, endMs: 9000, text: "今日はいい天気" },
    ])
  })

  it("moves the short words a cue ends on to the next cue", () => {
    const json3 = creator(
      ["hier soir nous sommes partis vers la", 0, 3000],
      ["gare centrale avant minuit puis on a", 3000, 6000],
      ["attendu le dernier bus sous la pluie", 6000, 9000],
    )
    expect(texts(cuesOf(json3, true))).toEqual([
      "hier soir nous sommes partis vers",
      "la gare centrale avant minuit puis",
      "on a attendu le dernier bus sous la pluie",
    ])
  })

  it("keeps the short words a cue ends on before a pause or a new speaker", () => {
    const json3 = creator(
      ["hier soir nous sommes partis vers la", 0, 3000],
      ["gare centrale avant minuit et", 5000, 8000],
      [">> le train était déjà parti", 8000, 9000],
    )
    expect(texts(cuesOf(json3, true))).toEqual([
      "hier soir nous sommes partis vers la",
      "gare centrale avant minuit et",
      "le train était déjà parti",
    ])
  })

  it("joins a cue of a few words to the one before", () => {
    const json3 = creator(
      ["le café était encore chaud à son retour", 0, 3000],
      ["ce matin", 3000, 4000],
      ["nous avons parlé de tout et de rien", 4000, 8000],
      ["Bonsoir", 10_000, 11_000],
    )
    expect(cuesOf(json3, true)).toEqual([
      { startMs: 0, endMs: 4000, text: "le café était encore chaud à son retour ce matin" },
      { startMs: 4000, endMs: 8000, text: "nous avons parlé de tout et de rien" },
      { startMs: 10_000, endMs: 11_000, text: "Bonsoir" },
    ])
  })

  it("drops speaker markers and sounds, which a creator's cues keep", () => {
    const json3: Json3 = {
      events: [
        {
          tStartMs: 0,
          dDurationMs: 4000,
          segs: [{ utf8: ">> Tak, tak." }, { utf8: " [śmiech]\n>> Dobrze." }],
        },
      ],
    }
    expect(texts(cuesOf(json3, true))).toEqual(["Tak, tak.\nDobrze."])
    expect(texts(cuesOf(json3, false))).toEqual([">> Tak, tak.\n>> Dobrze."])
  })
})

describe("cuesOf for creator captions", () => {
  it("keeps each cue and its lines", () => {
    const json3 = creator(
      [" Sie löst eigenständig \n einen Atomkrieg aus, ", 2960, 5080],
      ["制御盤や\n電気機器", 5200, 8000],
    )
    expect(cuesOf(json3, false)).toEqual([
      { startMs: 2960, endMs: 5080, text: "Sie löst eigenständig\neinen Atomkrieg aus," },
      { startMs: 5200, endMs: 8000, text: "制御盤や\n電気機器" },
    ])
  })

  it("drops the padding of no-break spaces", () => {
    expect(texts(cuesOf(creator(["Дуже добре,\u00a0\nдякую.\u00a0\u00a0", 0, 1000]), false))).toEqual([
      "Дуже добре,\nдякую.",
    ])
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
  const tracks = readdirSync(directory).map((name) => {
    const json3 = parseJson3(JSON.parse(readFileSync(new URL(name, directory), "utf8")))!
    const asr = name.includes(".asr.")
    const timed = json3.events.some(({ segs = [] }) => segs.some(({ tOffsetMs }) => tOffsetMs !== undefined))
    // Only timed auto captions are cut here. The rest keep YouTube's cues.
    return { name, asr, cut: asr && timed, json3 }
  })
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

  it.each(tracks.filter(({ cut }) => cut))("$name fits each cue in two lines", ({ json3 }) => {
    for (const { text } of cuesOf(json3, true)) {
      const lines = text.split("\n")
      expect(lines.length, text).toBeLessThanOrEqual(2)
      for (const line of lines) {
        expect(width(line), text).toBeLessThanOrEqual(LINE_WIDTH)
      }
    }
  })

  it.each(tracks.filter(({ asr, cut }) => asr && !cut))(
    "$name shows YouTube's cues, or a few joined, until the next or their own end",
    ({ json3 }) => {
      const starts = new Set(json3.events.map(({ tStartMs }) => tStartMs))
      const ends = new Set(json3.events.map(({ tStartMs, dDurationMs }) => tStartMs + dDurationMs))
      const cues = cuesOf(json3, true)
      for (const [index, cue] of cues.entries()) {
        const next = cues[index + 1]?.startMs
        expect(starts.has(cue.startMs)).toBe(true)
        expect(cue.endMs === next || (ends.has(cue.endMs) && cue.endMs <= (next ?? Infinity))).toBe(true)
      }
    },
  )

  it.each(tracks.filter(({ asr, cut }) => asr && !cut))(
    "$name puts each cue on one line, or a line for each speaker",
    ({ json3 }) => {
      for (const { text } of cuesOf(json3, true)) {
        expect(text.split("\n").length).toBeLessThanOrEqual(1 + (/>>/u.test(JSON.stringify(json3)) ? 1 : 0))
      }
    },
  )
})

describe("cuesOf on a long track", () => {
  /**
   * Tracks are cut while the player loads the video, on the page's own thread.
   * Measured against segmenting the same text, which the cut does once anyway, so a slow machine slows both.
   * Cutting takes 4 to 10 times as long as that, and took 80 to 400 times before each word's width and score were kept.
   */
  const MAX_SLOWDOWN = 30
  const MINUTES = 60
  const FIXTURE_MINUTES = 5

  const directory = new URL("./fixtures/", import.meta.url)
  const names = readdirSync(directory).filter((name) => name.includes(".asr."))

  /** The recorded start of a track over and over, each copy later in time, since fixtures keep only five minutes. */
  const long = (name: string): Json3 => {
    const { events } = parseJson3(JSON.parse(readFileSync(new URL(name, directory), "utf8")))!
    return {
      events: Array.from({ length: MINUTES / FIXTURE_MINUTES }, (_, copy) =>
        events.map((event) => ({ ...event, tStartMs: event.tStartMs + copy * FIXTURE_MINUTES * 60_000 })),
      ).flat(),
    }
  }

  /** The fastest of a few runs, so a pause in the test runner does not fail it. */
  const fastest = (run: () => unknown): number =>
    Math.min(
      ...Array.from({ length: 5 }, () => {
        const start = performance.now()
        run()
        return performance.now() - start
      }),
    )

  it.each(names)("cuts an hour of %s in time", (name) => {
    const json3 = long(name)
    const text = json3.events.flatMap(({ segs = [] }) => segs.map(({ utf8 }) => utf8)).join("")
    const segmenter = new Intl.Segmenter(undefined, { granularity: "word" })
    const reference = fastest(() => Array.from(segmenter.segment(text)))
    expect(fastest(() => cuesOf(json3, true)) / reference).toBeLessThan(MAX_SLOWDOWN)
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

describe("shownAt", () => {
  const cues = cuesOf(
    creator(["Raz", 0, 1000], ["Dwa", 1000, 2000], ["Trzy", 5000, 6000], ["Cztery", 9100, 9500]),
    false,
  )

  it("shows the cue before above when it ended just before", () => {
    expect(shownAt(cues, 1500, true)).toEqual({ text: "Dwa", previous: { text: "Raz" } })
    expect(shownAt(cues, 5500, true)).toEqual({ text: "Trzy", previous: { text: "Dwa" } })
  })

  it("leaves out a cue before that ended long before, or none", () => {
    expect(shownAt(cues, 500, true)).toEqual({ text: "Raz", previous: undefined })
    expect(shownAt(cues, 9200, true)).toEqual({ text: "Cztery", previous: undefined })
    expect(shownAt(cues, 3000, true)).toBeUndefined()
  })

  it("leaves out a cue before that was in another place", () => {
    const placed: Array<Cue> = [
      { startMs: 0, endMs: 1000, text: "Raz" },
      { startMs: 1000, endMs: 2000, text: "Dwa", place: { anchor: 4, x: 50, y: 55 } },
      { startMs: 2000, endMs: 3000, text: "Trzy", place: { anchor: 4, x: 50, y: 55 } },
    ]
    expect(shownAt(placed, 1500, true)?.previous).toBeUndefined()
    expect(shownAt(placed, 2500, true)?.previous).toEqual({ text: "Dwa" })
  })

  it("leaves styles and places out when told to", () => {
    const styled: Array<Cue> = [
      { startMs: 0, endMs: 1000, text: "Raz", styles: [{ color: "#ffff00", from: 0, to: 3 }] },
      { startMs: 1000, endMs: 2000, text: "Dwa", place: { anchor: 4, x: 50, y: 55 } },
    ]
    expect(shownAt(styled, 1500, false)).toEqual({ text: "Dwa", previous: { text: "Raz" } })
  })
})

describe("isFast", () => {
  /** Cues one after another, each on screen for its own time. */
  const paced = (...shown: Array<number>): Array<Cue> => {
    let startMs = 0
    return shown.map((ms, index) => {
      const cue = { startMs, endMs: startMs + ms, text: `${index}` }
      startMs += ms
      return cue
    })
  }

  it("is fast when most cues follow one shown under two seconds", () => {
    expect(isFast(paced(1500, 1800, 1200, 3000, 1600))).toBe(true)
  })

  it("is not when most cues stay longer", () => {
    expect(isFast(paced(2500, 1500, 4000, 3000, 6000))).toBe(false)
  })

  it("leaves out cues after a pause, which nothing slides into", () => {
    const apart = paced(1500, 1500, 1500).map((cue, index) => ({
      ...cue,
      startMs: cue.startMs + index * 5000,
      endMs: cue.endMs + index * 5000,
    }))
    expect(isFast(apart)).toBe(false)
  })

  it.each(["fr.manual.json", "de.manual.uN1Zx-Ia-SE.json", "fr.asr.json"])("finds %s calm", (name) => {
    const json3 = parseJson3(
      JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")),
    )!
    expect(isFast(cuesOf(json3, name.includes(".asr.")))).toBe(false)
  })
})
