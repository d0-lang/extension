import { describe, expect, it } from "vitest"
import { cuesOf, decodeText, extensionOf, isSubtitleFile, readSubtitleFile } from "./read"

const SRT = "1\n00:00:01,000 --> 00:00:02,000\nŻółw\n"

describe("decodeText", () => {
  it("reads UTF-8, with or without a byte order mark", () => {
    const bytes = new TextEncoder().encode(SRT)
    expect(decodeText(bytes.buffer)).toBe(SRT)
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...bytes]).buffer)).toBe(SRT)
  })

  it("reads UTF-16 that says so", () => {
    const le = [
      0xff,
      0xfe,
      ...[...SRT].flatMap((char) => [char.charCodeAt(0) & 0xff, char.charCodeAt(0) >> 8]),
    ]
    expect(decodeText(new Uint8Array(le).buffer)).toBe(SRT)
  })
})

describe("cuesOf", () => {
  it("reads SRT and WebVTT", () => {
    expect(cuesOf("Film.srt", SRT)._unsafeUnwrap()).toEqual([{ startMs: 1000, endMs: 2000, text: "Żółw" }])
    expect(cuesOf("Film.VTT", `WEBVTT\n\n${SRT.replace(",", ".")}`).isOk()).toBe(true)
  })

  it("says which files it does not read, and when a file has no cues", () => {
    expect(cuesOf("Film.ass", "[Script Info]")._unsafeUnwrapErr()).toEqual({
      kind: "unsupported",
      extension: "ass",
    })
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
  it("knows subtitle files by their extension, read now or not", () => {
    expect(isSubtitleFile("Film.en.SRT")).toBe(true)
    expect(isSubtitleFile("Film.ass")).toBe(true)
    expect(isSubtitleFile("Film.mkv")).toBe(false)
    expect(extensionOf("Film")).toBe("")
  })
})
