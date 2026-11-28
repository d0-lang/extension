import { describe, expect, it } from "vitest"
import { cuesOf, extensionOf, isSubtitleFile, readSubtitleFile } from "./read"

const SRT = "1\n00:00:01,000 --> 00:00:02,000\nŻółw\n"

describe("cuesOf", () => {
  it("reads SRT and WebVTT", () => {
    expect(cuesOf("Film.srt", SRT)._unsafeUnwrap()).toEqual([{ startMs: 1000, endMs: 2000, text: "Żółw" }])
    expect(cuesOf("Film.VTT", `WEBVTT\n\n${SRT.replace(",", ".")}`).isOk()).toBe(true)
    expect(
      cuesOf(
        "Film.ssa",
        "[Events]\nDialogue: Marked=0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Żółw",
      )._unsafeUnwrap(),
    ).toEqual([{ startMs: 1000, endMs: 2000, text: "Żółw" }])
  })

  it("says which files it does not read, and when a file has no cues", () => {
    expect(cuesOf("Film.sub", "{1}{25}Raz")._unsafeUnwrapErr()).toEqual({
      kind: "unsupported",
      extension: "sub",
    })
    expect(cuesOf("Film.ass", "[Script Info]")._unsafeUnwrapErr()).toEqual({ kind: "empty" })
    expect(cuesOf("Film.srt", "not subtitles")._unsafeUnwrapErr()).toEqual({ kind: "empty" })
  })
})

describe("readSubtitleFile", () => {
  it("reads a dropped file", async () => {
    const cues = await readSubtitleFile(new File([SRT], "Film.srt"))
    expect(cues._unsafeUnwrap()).toHaveLength(1)
  })
})

describe("isSubtitleFile", () => {
  it("knows subtitle files by their extension", () => {
    expect(isSubtitleFile("Film.en.SRT")).toBe(true)
    expect(isSubtitleFile("Film.ass")).toBe(true)
    expect(isSubtitleFile("Film.sub")).toBe(false)
    expect(isSubtitleFile("Film.mkv")).toBe(false)
    expect(extensionOf("Film")).toBe("")
  })
})
