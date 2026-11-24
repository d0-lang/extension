import { describe, expect, it } from "vitest"
import clipUrl from "./fixtures/clip.mkv?url"
import { remuxToMp4 } from "./remux"

/** A second of H.264 video, 64 pixels square, with AAC sound. */
const clip = async () => new File([await (await fetch(clipUrl)).blob()], "clip.mkv")

describe("remuxToMp4", () => {
  it("rewraps Matroska as MP4 the browser plays, with its progress", async () => {
    const shares: Array<number> = []
    const mp4 = (await remuxToMp4(await clip(), (share) => shares.push(share)))._unsafeUnwrap()
    expect(mp4.type).toBe("video/mp4")
    expect(shares.at(-1)).toBeGreaterThan(0.9)

    const video = document.createElement("video")
    video.src = URL.createObjectURL(mp4)
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve
      video.onerror = reject
    })
    expect(video.videoWidth).toBe(64)
    expect(video.duration).toBeCloseTo(1, 0)
  })

  it("stops when canceled", async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await remuxToMp4(await clip(), () => {}, controller.signal)
    expect(result._unsafeUnwrapErr()).toEqual({ kind: "canceled" })
  })
})
