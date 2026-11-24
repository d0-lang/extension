import { afterEach, describe, expect, it } from "vitest"
import { activeTrack, cuesOf, plainText } from "./tracks"

afterEach(() => {
  document.body.replaceChildren()
})

/** A video with a track of `cues`, each `[text, startSeconds, endSeconds]`, in `mode`. */
const trackWith = (
  cues: ReadonlyArray<[string, number, number]>,
  mode: TextTrackMode = "hidden",
  kind: TextTrackKind = "subtitles",
): { video: HTMLVideoElement; track: TextTrack } => {
  const video = document.createElement("video")
  document.body.append(video)
  const track = video.addTextTrack(kind, "", "pl")
  for (const [text, start, end] of cues) {
    track.addCue(new VTTCue(start, end, text))
  }
  track.mode = mode
  return { video, track }
}

describe("plainText", () => {
  it("drops tags and speakers, and reads entities", () => {
    expect(plainText("<v Anna><i>Ala</i> ma &amp; <b>kota</b></v>")).toBe("Ala ma & kota")
  })

  it("keeps lines, without empty ones or extra spaces", () => {
    expect(plainText("  Ala  ma\n\n  kota ")).toBe("Ala ma\nkota")
  })
})

describe("activeTrack", () => {
  it("takes the track the browser draws over one it keeps hidden", () => {
    const { video } = trackWith([["Raz", 0, 1]], "hidden")
    const drawn = video.addTextTrack("captions", "", "en")
    drawn.mode = "showing"
    expect(activeTrack(video)).toBe(drawn)
  })

  it("takes a hidden track, which a player draws itself", () => {
    const { video, track } = trackWith([["Raz", 0, 1]], "hidden")
    expect(activeTrack(video)).toBe(track)
  })

  it("finds none while subtitles are off, or only other kinds of track are on", () => {
    expect(activeTrack(trackWith([["Raz", 0, 1]], "disabled").video)).toBeUndefined()
    expect(activeTrack(trackWith([["Raz", 0, 1]], "hidden", "metadata").video)).toBeUndefined()
  })
})

describe("cuesOf", () => {
  it("reads cues in order, as plain text", () => {
    const { track } = trackWith([
      ["<i>Dwa</i>", 2, 3],
      ["Raz", 0, 1],
    ])
    expect(cuesOf(track)).toEqual([
      { startMs: 0, endMs: 1000, text: "Raz" },
      { startMs: 2000, endMs: 3000, text: "Dwa" },
    ])
  })

  it("puts cues that start together on a line each", () => {
    const { track } = trackWith([
      ["- Idziesz?", 0, 2],
      ["- Tak.", 0, 3],
    ])
    expect(cuesOf(track)).toEqual([{ startMs: 0, endMs: 3000, text: "- Idziesz?\n- Tak." }])
  })

  it("ends a cue where the next starts, and drops empty ones", () => {
    const { track } = trackWith([
      ["Raz", 0, 3],
      ["<i></i>", 1, 2],
      ["Dwa", 2, 4],
    ])
    expect(cuesOf(track)).toEqual([
      { startMs: 0, endMs: 2000, text: "Raz" },
      { startMs: 2000, endMs: 4000, text: "Dwa" },
    ])
  })
})
