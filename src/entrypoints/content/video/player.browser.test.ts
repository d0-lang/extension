import { afterEach, describe, expect, it } from "vitest"
import { playerOf } from "./player"

afterEach(() => {
  document.body.replaceChildren()
})

/** A video in boxes from the outside in, each with its own style. */
const videoIn = (...styles: Array<string>): { video: HTMLVideoElement; boxes: Array<HTMLElement> } => {
  const boxes = styles.map((style) => {
    const box = document.createElement("div")
    box.style.cssText = style
    return box
  })
  boxes.reduce((outer, inner) => (outer.append(inner), inner))
  const video = document.createElement("video")
  video.style.cssText = "display: block; width: 640px; height: 360px"
  boxes.at(-1)!.append(video)
  document.body.append(boxes[0]!)
  return { video, boxes }
}

describe("playerOf", () => {
  it("finds the outermost positioned box as big as the video, which holds the player's own subtitles", () => {
    const { video, boxes } = videoIn("position: relative", "", "position: absolute")
    expect(playerOf(video)).toBe(boxes[0])
  })

  it("leaves out a box that holds more than the video", () => {
    const { video, boxes } = videoIn("position: relative; padding-bottom: 300px", "position: relative")
    expect(playerOf(video)).toBe(boxes[1])
  })

  it("finds none in a page with no player box", () => {
    const { video } = videoIn("", "")
    expect(playerOf(video)).toBeUndefined()
  })

  it("finds none when the box around the video holds more, like a title under it", () => {
    const { video } = videoIn("position: relative", "padding-bottom: 300px")
    expect(playerOf(video)).toBeUndefined()
  })
})
