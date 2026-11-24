import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { showVideoSubtitles } from "./captions"

let controller = new AbortController()

const ctx = () =>
  ({
    signal: controller.signal,
    setTimeout: (handler: () => void, ms: number) => window.setTimeout(handler, ms),
    requestAnimationFrame: (handler: () => void) => window.requestAnimationFrame(handler),
    onInvalidated: () => {},
  }) as unknown as ContentScriptContext

beforeEach(() => {
  // Nothing is stored, so every setting is its default.
  vi.stubGlobal("browser", {
    storage: { local: { get: () => Promise.resolve({}) }, onChanged: { addListener: () => {} } },
  })
})

afterEach(() => {
  controller.abort()
  controller = new AbortController()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

/** A player box with a video in it, which has a Polish track of one cue at the start. */
const setUp = (mode: TextTrackMode) => {
  const player = document.createElement("div")
  player.style.cssText = "position: relative; width: 640px; height: 360px"
  const video = document.createElement("video")
  video.style.cssText = "display: block; width: 640px; height: 360px"
  player.append(video)
  document.body.append(player)
  const track = video.addTextTrack("subtitles", "", "pl")
  track.addCue(new VTTCue(0, 5, "Mamy gościa."))
  track.mode = mode
  showVideoSubtitles(ctx(), {
    isEnabled: () => true,
    lookUp: () => {},
    isShown: () => false,
    close: () => {},
  })
  video.dispatchEvent(new Event("timeupdate"))
  return { player, video, track }
}

const shown = () => document.querySelector("[data-dadict-captions]:not([hidden])")?.textContent

describe("showVideoSubtitles", () => {
  it("shows the track the page has on over its video, once it plays", async () => {
    const { player } = setUp("hidden")
    await vi.waitFor(() => expect(shown()).toBe("Mamy gościa."))
    expect(player.querySelector("[data-dadict-captions]")).not.toBeNull()
  })

  it("leaves a video with subtitles off alone", async () => {
    setUp("disabled")
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    expect(document.querySelector("[data-dadict-captions]")).toBeNull()
  })

  it("goes when the page turns its subtitles off", async () => {
    const { track } = setUp("showing")
    await vi.waitFor(() => expect(shown()).toBe("Mamy gościa."))
    track.mode = "disabled"
    await vi.waitFor(() => expect(document.querySelector("[data-dadict-captions]")).toBeNull())
  })
})
