import { describe, expect, it } from "vitest"
import { matchingFirst, sortFiles } from "./files"

const file = (name: string, type = "") => new File([""], name, { type })

describe("sortFiles", () => {
  it("finds the video by its type or extension, and the subtitle files", () => {
    const { video, subtitles } = sortFiles([
      file("notes.txt"),
      file("Film.en.srt"),
      file("Film.mkv"),
      file("Film.de.vtt"),
    ])
    expect(video?.name).toBe("Film.mkv")
    expect(subtitles.map(({ name }) => name)).toEqual(["Film.en.srt", "Film.de.vtt"])
    expect(sortFiles([file("clip", "video/mp4")]).video?.name).toBe("clip")
  })
})

describe("matchingFirst", () => {
  it("puts the subtitles named after the video first", () => {
    const order = matchingFirst("Film.mkv", [file("Other.srt"), file("film.en.srt")])
    expect(order.map(({ name }) => name)).toEqual(["film.en.srt", "Other.srt"])
  })
})
