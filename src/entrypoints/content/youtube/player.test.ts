import { describe, expect, it } from "vitest"
import { isYouTube, videoIdOf } from "./player"

describe("videoIdOf", () => {
  it("reads the video from each kind of page", () => {
    expect(videoIdOf(new URL("https://www.youtube.com/watch?v=XwI2ku2_7rU&list=PL1&index=9"))).toBe(
      "XwI2ku2_7rU",
    )
    expect(videoIdOf(new URL("https://m.youtube.com/watch?v=uN1Zx-Ia-SE"))).toBe("uN1Zx-Ia-SE")
    expect(videoIdOf(new URL("https://www.youtube.com/shorts/0hyv-mrTxJQ"))).toBe("0hyv-mrTxJQ")
    expect(videoIdOf(new URL("https://www.youtube-nocookie.com/embed/6WCgEXrezyo?start=10"))).toBe(
      "6WCgEXrezyo",
    )
  })

  it("finds none on pages without a video", () => {
    expect(videoIdOf(new URL("https://www.youtube.com/"))).toBeUndefined()
    expect(videoIdOf(new URL("https://www.youtube.com/@ICHIKEN/videos"))).toBeUndefined()
  })
})

describe("isYouTube", () => {
  it("takes YouTube and its embeds only", () => {
    expect(isYouTube("www.youtube.com")).toBe(true)
    expect(isYouTube("www.youtube-nocookie.com")).toBe(true)
    expect(isYouTube("youtube.example.com")).toBe(false)
  })
})
