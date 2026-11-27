import { afterEach, describe, expect, it } from "vitest"
import { replacesOwn, siteFilesOf } from "./sites"

afterEach(() => document.body.replaceChildren())

/** ARD's player as far as the rule reads it: the seek bar 150 px up a 640 px tall player, and the subtitle button. */
const ardPlayer = ({ controls, subtitles }: { controls: boolean; subtitles: boolean }) => {
  document.body.innerHTML = `
    <div class="wrapper" style="position: relative; width: 1136px; height: 640px">
      <div class="ardplayer${controls ? " ardplayer-show-controls" : ""}" style="position: absolute; inset: 0">
        <video style="width: 100%; height: 100%"></video>
        <div class="ardplayer-controlbar" style="position: absolute; bottom: 130px; height: 20px; width: 100%"></div>
        <button><span class="ardplayer-icon ${subtitles ? "ardplayer-icon-utactive" : "ardplayer-icon-ut"}"></span></button>
        <div class="ardplayer-viewport-addon-overlays"><div class="ardplayer-untertitel"></div></div>
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

  it("shows its file only while ARD still draws its own subtitles where they are hidden", () => {
    const { wrapper, video } = ardPlayer({ controls: false, subtitles: true })
    expect(replacesOwn(ard, video, wrapper)).toBe(true)
    document.querySelector(".ardplayer-untertitel")!.className = "ardplayer-subtitles"
    expect(replacesOwn(ard, video, wrapper)).toBe(false)
    expect(replacesOwn(ard, video, undefined)).toBe(false)
  })
})

const arte = siteFilesOf("www.arte.tv")!

describe("Arte", () => {
  const files =
    "https://arte-cmafhls.akamaized.net/am/cmaf/120000/120900/120956-000-A/2026112405312FB56B2A148AE8E920833F56F981B6/medias"

  it("reads the subtitle files, not the seek bar's thumbnails or the playlists", () => {
    expect(arte.file.test(`${files}/120956-000-A_st_VO-ANG_44145048_7519626_20261124052214.vtt`)).toBe(true)
    expect(arte.file.test(`${files}/120956-000-A_st_VO-ANG_44145048_7519626_20261124052214.m3u8`)).toBe(false)
    expect(arte.file.test(`${files}/120956-000-A_SPR.vtt`)).toBe(false)
  })

  it("names the language from the subtitles' version", () => {
    expect(arte.lang?.(`${files}/120956-000-A_st_VO-ANG_44145048_7519626_20261124052214.vtt`)).toBe("en")
    expect(arte.lang?.(`${files}/120956-000-A_st_VF-FRA_44145048_7389929_20261124052214.vtt`)).toBe("fr")
    expect(arte.lang?.(`${files}/120956-000-A_st_VA-MAL_44145048_7475401_20261124052214.vtt`)).toBe("de")
  })

  /** Arte's player as far as the rule reads it, showing subtitles or not: its seek bar 89 px up a 576 px tall player. */
  const artePlayer = (showing: boolean, controls = false) => {
    document.body.innerHTML = `
      <div class="avp-player${controls ? " showControls" : ""}" style="position: absolute; width: 1024px; height: 576px">
        <div class="avp-content"><div class="avp-controlbar" style="position: absolute; bottom: 25px; height: 64px; width: 100%"></div></div>
        <div class="vjs-dimensions">
          <video></video>
          <div class="vjs-text-track-display" aria-live="${showing ? "assertive" : "off"}"></div>
        </div>
      </div>`
    return {
      player: document.querySelector<HTMLElement>(".avp-player")!,
      video: document.querySelector("video")!,
    }
  }

  it("has its subtitles on while video.js shows a track, in the player it names", () => {
    const { player, video } = artePlayer(true)
    expect(arte.player?.(video)).toBe(player)
    expect(replacesOwn(arte, video, player)).toBe(true)
    expect(arte.isOn(artePlayer(false).video)).toBe(false)
  })

  it("keeps the subtitles above the seek bar only while the controls show", () => {
    expect(arte.host.bars(artePlayer(true, true).player).bottom).toBe(89)
    expect(arte.host.bars(artePlayer(true, false).player).bottom).toBeCloseTo(576 * 0.12)
  })
})
