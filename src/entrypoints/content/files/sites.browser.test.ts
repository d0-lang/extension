import { afterEach, describe, expect, it } from "vitest"
import { siteFilesOf } from "./sites"

afterEach(() => document.body.replaceChildren())

/** ARD's player as far as the rule reads it: the seek bar 150 px up a 640 px tall player, and the subtitle button. */
const ardPlayer = ({ controls, subtitles }: { controls: boolean; subtitles: boolean }) => {
  document.body.innerHTML = `
    <div class="wrapper" style="position: relative; width: 1136px; height: 640px">
      <div class="ardplayer${controls ? " ardplayer-show-controls" : ""}" style="position: absolute; inset: 0">
        <video style="width: 100%; height: 100%"></video>
        <div class="ardplayer-controlbar" style="position: absolute; bottom: 130px; height: 20px; width: 100%"></div>
        <button><span class="ardplayer-icon ${subtitles ? "ardplayer-icon-utactive" : "ardplayer-icon-ut"}"></span></button>
      </div>
    </div>`
  return {
    wrapper: document.querySelector<HTMLElement>(".wrapper")!,
    video: document.querySelector("video")!,
  }
}

const ard = siteFilesOf("www.ardmediathek.de")!

describe("ARD", () => {
  it("is the Mediathek and tagesschau.de, which uses its player", () => {
    expect(siteFilesOf("www.tagesschau.de")).toBe(ard)
    expect(siteFilesOf("www.zdf.de")).toBeUndefined()
    expect(siteFilesOf("notardmediathek.de")).toBeUndefined()
  })

  it("reads the files from ARD's API and from tagesschau.de", () => {
    expect(
      ard.file.test(
        "https://api.ardmediathek.de/player-service/subtitle/ebutt/urn:ard:subtitle:6a5998a35ff649ee",
      ),
    ).toBe(true)
    expect(ard.file.test("https://www.tagesschau.de/video/ut-218148.xml")).toBe(true)
    expect(ard.file.test("https://www.tagesschau.de/video/video-1690942.html")).toBe(false)
  })

  it("has its subtitles on while the button shows them active", () => {
    expect(ard.isOn(ardPlayer({ controls: false, subtitles: true }).video)).toBe(true)
    expect(ard.isOn(ardPlayer({ controls: false, subtitles: false }).video)).toBe(false)
  })

  it("keeps the subtitles above the seek bar only while the controls show", () => {
    expect(ard.host.bars(ardPlayer({ controls: true, subtitles: true }).wrapper).bottom).toBe(150)
    expect(ard.host.bars(ardPlayer({ controls: false, subtitles: true }).wrapper).bottom).toBeCloseTo(
      640 * 0.12,
    )
  })
})
