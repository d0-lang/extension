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
      { startMs: 1000, endMs: 2500, text: "Ala ma kota,\ni dwa psy." },
      { startMs: 3000, endMs: 4000, text: "Raz dwa trzy" },
    ])
  })

  it("leaves out signs, drawings, karaoke and effects", () => {
    expect(
      readAss(
        events(
          "Dialogue: 0,0:00:01.00,0:00:05.00,Sign,,0,0,0,,{\\an8\\pos(640,80)}Dworzec Centralny",
          "Dialogue: 0,0:00:01.00,0:00:05.00,Sign,,0,0,0,,{\\move(0,0,100,100)}Ulica",
          "Dialogue: 0,0:00:01.00,0:00:05.00,Sign,,0,0,0,,{\\p1}m 0 0 l 100 0 100 100",
          "Dialogue: 0,0:00:01.00,0:00:05.00,OP,,0,0,0,,{\\k20}Ra{\\kf30}zem",
          "Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,Scroll up;10;100;5,Napisy",
          "Dialogue: 0,0:00:02.00,0:00:03.00,Default,,0,0,0,,{\\an8}Mówię u góry",
        ),
      ),
    ).toEqual([{ startMs: 2000, endMs: 3000, text: "Mówię u góry" }])
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
})
