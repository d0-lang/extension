import { describe, expect, it } from "vitest"
import { readTimed, timingOf } from "./timed"

describe("timingOf", () => {
  it("reads SRT's comma and WebVTT's dot, with or without hours", () => {
    expect(timingOf("00:01:02,500 --> 01:00:00,000")).toEqual({ startMs: 62_500, endMs: 3_600_000 })
    expect(timingOf("01:02.5 --> 01:03.250 align:start")).toEqual({ startMs: 62_500, endMs: 63_250 })
  })

  it("finds none on a line of text", () => {
    expect(timingOf("Ala ma kota")).toBeUndefined()
  })
})

describe("readTimed", () => {
  it("reads SRT blocks, with Windows line ends and tags", () => {
    const srt =
      "1\r\n00:00:01,000 --> 00:00:02,000\r\n<i>Ala</i> ma\r\nkota\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nDwa\r\n"
    expect(readTimed(srt)).toEqual([
      { startMs: 1000, endMs: 2000, text: "Ala ma\nkota" },
      { startMs: 3000, endMs: 4000, text: "Dwa" },
    ])
  })

  it("skips WebVTT's header, notes and styles, and a cue's name", () => {
    const vtt = [
      "WEBVTT - a film",
      "",
      "NOTE made by hand",
      "",
      "STYLE",
      "::cue { color: red }",
      "",
      "intro",
      "00:01.000 --> 00:02.000 line:0",
      "<v Anna>Raz</v>",
    ].join("\n")
    expect(readTimed(vtt)).toEqual([{ startMs: 1000, endMs: 2000, text: "Raz" }])
  })

  it("takes blank lines with spaces as gaps between blocks", () => {
    expect(
      readTimed("00:00:01,000 --> 00:00:02,000\nRaz\n  \n00:00:03,000 --> 00:00:04,000\nDwa"),
    ).toHaveLength(2)
  })
})
