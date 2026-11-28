import { describe, expect, it } from "vitest"
import { readAss } from "./ass"

const ASS = [
  "[Script Info]",
  "Title: Odcinek 1",
  "ScriptType: v4.00+",
  "",
  "[V4+ Styles]",
  "Format: Name, Fontname, Fontsize, PrimaryColour, Alignment",
  "Style: Default,Arial,48,&H00FFFFFF,2",
  "",
  "[Events]",
  "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  "Dialogue: 0,0:00:01.00,0:00:02.50,Default,Ala,0,0,0,,{\\i1}Ala{\\i0} ma kota,\\Ni dwa psy.",
  "Comment: 0,0:00:03.00,0:00:04.00,Default,,0,0,0,,Tylko dla tłumacza",
  "Dialogue: 0,0:00:03.00,0:00:04.00,Default,,0,0,0,,Raz{ notatka }\\hdwa\\ntrzy",
].join("\r\n")

const events = (...lines: Array<string>): string =>
  [
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...lines,
  ].join("\n")

describe("readAss", () => {
  it("reads dialogue, with commas in its text, line breaks and no tags or comments", () => {
    expect(readAss(ASS)).toEqual([
      {
        startMs: 1000,
        endMs: 2500,
        text: "Ala ma kota,\ni dwa psy.",
        styles: [{ italic: true, from: 0, to: 3 }],
      },
      { startMs: 3000, endMs: 4000, text: "Raz dwa trzy" },
    ])
  })

  it("leaves out signs, drawings and effects", () => {
    expect(
      readAss(
        events(
          "Dialogue: 0,0:00:01.00,0:00:05.00,Sign,,0,0,0,,{\\an8\\pos(640,80)}Dworzec Centralny",
          "Dialogue: 0,0:00:01.00,0:00:05.00,Sign,,0,0,0,,{\\move(0,0,100,100)}Ulica",
          "Dialogue: 0,0:00:01.00,0:00:05.00,Sign,,0,0,0,,{\\p1}m 0 0 l 100 0 100 100",
          "Dialogue: 0,0:00:01.00,0:00:01.10,OP,,0,0,0,fx,{\\an5\\pos(300,40)}Ra",
          "Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,Scroll up;10;100;5,Napisy",
          "Dialogue: 0,0:00:02.00,0:00:03.00,Default,,0,0,0,,{\\an8}Mówię u góry",
        ),
      ),
    ).toEqual([{ startMs: 2000, endMs: 3000, text: "Mówię u góry" }])
  })

  it("shows a song's karaoke line whole", () => {
    expect(
      readAss(
        events("Dialogue: 0,0:00:01.00,0:00:05.00,OP,,0,0,0,,{\\k20}Ra{\\kf30}zem {\\ko25}we {\\K40}dwoje"),
      ),
    ).toEqual([{ startMs: 1000, endMs: 5000, text: "Razem we dwoje" }])
  })

  it("reads the sung lines a karaoke template was made from, in place of what it made", () => {
    const sung = events(
      "Comment: 0,0:00:00.00,0:00:00.00,OP,,0,0,0,template line,{\\fad(300,200)}",
      "Comment: 0,0:00:01.00,0:00:03.00,OP,,0,0,0,karaoke,{\\k20}Ra{\\k30}zem",
      "Dialogue: 0,0:00:00.10,0:00:03.20,OP,,0,0,0,fx,{\\fad(300,200)}{\\k90}{\\k20}Ra{\\k30}zem",
      "Dialogue: 0,0:00:01.00,0:00:01.20,OP,,0,0,0,fx,{\\an5\\pos(300,40)}Ra",
    )
    expect(readAss(sung)).toEqual([{ startMs: 1000, endMs: 3000, text: "Razem" }])
  })

  it("reads whole karaoke lines a template made when the file has nothing else", () => {
    expect(
      readAss(
        events("Dialogue: 0,0:00:01.00,0:00:03.00,OP,,0,0,0,fx,{\\k90\\fad(300,200)}{\\k20}Ra{\\k30}zem"),
      ),
    ).toEqual([{ startMs: 1900, endMs: 3000, text: "Razem" }])
  })

  it("shows a song's kanji and romaji together, after the lead-in, with the readings over the kanji", () => {
    const song = events(
      "Comment: 0,0:00:10.20,0:00:16.12,Kanji,,0,0,0,karaoke,{\\k90}{\\k19}ね{\\k52}ぇ　{\\k17}忘|わ{\\k17}#|す{\\k16}れ{\\k16}な{\\k17}い{\\k27}で",
      "Comment: 0,0:00:11.20,0:00:16.12,Romaji,,0,0,0,karaoke,{\\k19}ne{\\k52}e {\\k17}wa{\\k17}su{\\k16}re{\\k16}na{\\k17}i{\\k27}de",
    )
    expect(readAss(song)).toEqual([
      { startMs: 11_100, endMs: 16_120, text: "ねぇ 忘れないで", ruby: [{ from: 3, to: 4, text: "わす" }] },
      { startMs: 11_100, endMs: 16_120, text: "nee wasurenaide" },
    ])
  })

  it("puts a reading over each kanji of a karaoke line, and none over a syllable without one", () => {
    expect(
      readAss(
        events(
          "Dialogue: 0,0:00:01.00,0:00:03.00,OP,,0,0,0,,{\\k10}明|あ{\\k10}#|し{\\k10}#|た{\\k10}の{\\k10}空|そら",
        ),
      ),
    ).toEqual([
      {
        startMs: 1000,
        endMs: 3000,
        text: "明の空",
        ruby: [
          { from: 0, to: 1, text: "あした" },
          { from: 2, to: 3, text: "そら" },
        ],
      },
    ])
  })

  it("goes on with a karaoke reading past tags of its own between its syllables", () => {
    expect(
      readAss(
        events("Dialogue: 0,0:00:01.00,0:00:03.00,OP,,0,0,0,,{\\k10}明|あ{\\i1}{\\k10}#|し{\\k10}#|た"),
      ),
    ).toMatchObject([{ text: "明", ruby: [{ from: 0, to: 1, text: "あした" }] }])
  })

  it("keeps a # of a line that is not sung", () => {
    expect(
      readAss(events("Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,C{\\i1}#{\\i0} major")),
    ).toMatchObject([{ text: "C# major" }])
  })

  it("keeps one of the same line drawn twice, like an outline under it", () => {
    expect(
      readAss(
        events(
          "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\bord4}Raz",
          "Dialogue: 1,0:00:01.00,0:00:02.00,Default,,0,0,0,,Raz",
        ),
      ),
    ).toEqual([{ startMs: 1000, endMs: 2000, text: "Raz" }])
  })

  it("reads the fields in the order the file lists them, as SSA does", () => {
    const ssa = [
      "[Events]",
      "Format: Marked, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
      "Dialogue: Marked=0,1:02:03.45,1:02:04.00,Default,,0000,0000,0000,,Dwa",
    ].join("\n")
    expect(readAss(ssa)).toEqual([{ startMs: 3_723_450, endMs: 3_724_000, text: "Dwa" }])
  })

  it("reads nothing outside the events", () => {
    expect(readAss("[Script Info]\nDialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Raz")).toEqual([])
  })
  it("draws lines in their style's colour, italics and bold, and in what their tags change", () => {
    const styled = [
      "[V4+ Styles]",
      "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic",
      "Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0",
      "Style: Thought,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,-1",
      "Style: Anna,Arial,48,&H0000FFFF,&H000000FF,&H00000000,&H00000000,-1,0",
      "",
      events(
        "Dialogue: 0,0:00:01.00,0:00:02.00,Thought,,0,0,0,,Myślę",
        "Dialogue: 0,0:00:02.00,0:00:03.00,Anna,,0,0,0,,Raz {\\rDefault}dwa {\\r}trzy",
        "Dialogue: 0,0:00:03.00,0:00:04.00,Default,,0,0,0,,{\\c&HFF8000&}Niebo {\\b1\\1c&H00FF00&}trawa{\\b0\\c} koniec",
      ),
    ].join("\n")
    expect(readAss(styled).map(({ styles }) => styles)).toEqual([
      [{ italic: true, from: 0, to: 5 }],
      [
        { color: "#ffff00", bold: true, from: 0, to: 4 },
        { color: "#ffff00", bold: true, from: 8, to: 12 },
      ],
      [
        { color: "#0080ff", from: 0, to: 6 },
        { color: "#00ff00", bold: true, from: 6, to: 11 },
      ],
    ])
  })

  it("leaves out white, which subtitles draw in anyway", () => {
    const white = events(
      "Dialogue: 0,0:00:02.00,0:00:03.00,Default,,0,0,0,,{\\c&HFFFFFF&}Dwa {\\c&H800000&}trzy",
    )
    expect(readAss(white).map(({ styles }) => styles)).toEqual([[{ color: "#000080", from: 4, to: 8 }]])
  })
})
