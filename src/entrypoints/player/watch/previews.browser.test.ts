import { describe, expect, it } from "vitest"
import clipUrl from "../open/fixtures/clip.mkv?url"
import { remuxToMp4 } from "../open/remux"
import { Previews } from "./previews.svelte"

describe("Previews", () => {
  it("takes a frame from a hidden copy of the video, and lets it go on stop", async () => {
    const clip = new File([await (await fetch(clipUrl)).blob()], "clip.mkv")
    const mp4 = (await remuxToMp4(clip, () => {}))._unsafeUnwrap()
    const previews = new Previews(URL.createObjectURL(mp4))
    await expect.poll(() => previews.frameAt(0.5), { timeout: 5000 }).toMatch(/^blob:/)

    const image = new Image()
    image.src = previews.frameAt(0.5)!
    await image.decode()
    expect(image.naturalWidth).toBe(160)

    previews.stop()
    expect(previews.frames.size).toBe(0)
  })
})
