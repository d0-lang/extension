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
    expect(siteFilesOf("www.br.de")).toBeUndefined()
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

  /** Arte's player as far as the rule reads it: its seek bar 89 px up a 576 px tall player. */
  const artePlayer = (controls = false) => {
    document.body.innerHTML = `
      <div class="avp-player${controls ? " showControls" : ""}" style="position: absolute; width: 1024px; height: 576px">
        <div class="avp-content"><div class="avp-controlbar" style="position: absolute; bottom: 25px; height: 64px; width: 100%"></div></div>
        <div class="vjs-dimensions"><video></video><div class="vjs-text-track-display"></div></div>
      </div>`
    return {
      player: document.querySelector<HTMLElement>(".avp-player")!,
      video: document.querySelector("video")!,
    }
  }

  it("has its subtitles on while the viewer's pick in its menu is a track, in the player it names", () => {
    const { player, video } = artePlayer()
    localStorage.setItem("arte_vp.userPreferredCaption", "en-subtitles")
    expect(arte.player?.(video)).toBe(player)
    expect(replacesOwn(arte, video, player)).toBe(true)
    localStorage.setItem("arte_vp.userPreferredCaption", "none")
    expect(arte.isOn(video)).toBe(false)
    localStorage.removeItem("arte_vp.userPreferredCaption")
    expect(arte.isOn(video)).toBe(false)
  })

  it("keeps the subtitles above the seek bar only while the controls show", () => {
    expect(arte.host.bars(artePlayer(true).player).bottom).toBe(89)
    expect(arte.host.bars(artePlayer(false).player).bottom).toBeCloseTo(576 * 0.12)
  })
})

const zdf = siteFilesOf("www.zdf.de")!

describe("ZDF", () => {
  it("reads its subtitle files", () => {
    expect(
      zdf.file.test(
        "https://utstreaming.zdf.de/mtt/zdf/26/10/261022_1000_sendung_dbw/5/F1054887_hoh_deu_Die_Bergretter_Stimmen_der_Vergangenheit_18_1_P0035270_F03_M01_52203694.xml",
      ),
    ).toBe(true)
    expect(zdf.file.test("https://www.zdf.de/video/serien/die-bergretter-104")).toBe(false)
  })

  /** ZDF's player as far as the rule reads it: its bottom controls 150 px up an 800 px tall player. */
  const zdfPlayer = (subtitles: string, idle: boolean) => {
    document.body.innerHTML = `
      <div class="zdfplayer-app${idle ? " zdfplayer-idle" : ""}" style="position: relative; width: 1280px; height: 800px">
        <div class="zdfplayer-video-container"><video></video></div>
        <div class="subtitles-3TXyQO zdfplayer-subtitles-unscoped"></div>
        <div class="bottom-controls-22tEPl" style="position: absolute; bottom: 0; height: 150px; width: 100%"></div>
        <form>${["hoh_deu", "off"].map((value) => `<input type="radio" name="subtitles" value="${value}" ${value === subtitles ? "checked" : ""}>`).join("")}</form>
      </div>`
    return {
      player: document.querySelector<HTMLElement>(".zdfplayer-app")!,
      video: document.querySelector("video")!,
    }
  }

  it("has its subtitles on while one is picked, in the player it names", () => {
    const { player, video } = zdfPlayer("hoh_deu", true)
    expect(zdf.player?.(video)).toBe(player)
    expect(replacesOwn(zdf, video, player)).toBe(true)
    expect(zdf.isOn(zdfPlayer("off", true).video)).toBe(false)
  })

  it("keeps the subtitles above its controls only while the player is not idle", () => {
    expect(zdf.host.bars(zdfPlayer("hoh_deu", false).player).bottom).toBe(150)
    expect(zdf.host.bars(zdfPlayer("hoh_deu", true).player).bottom).toBeCloseTo(800 * 0.12)
  })
})

const rtve = siteFilesOf("www.rtve.es")!

describe("RTVE Play", () => {
  /** RTVE's player as far as the rule reads it: a 600 px tall player whose picture leaves 200 px for its controls. */
  const rtvePlayer = (checked: "es" | "off") => {
    document.body.innerHTML = `
      <div class="theoplayer-skin" style="position: absolute; width: 1000px; height: 600px">
        <div class="vjs-tech" style="height: 400px"><video></video><div class="theoplayer-texttracks"></div></div>
        <ul class="theo-menu">
          <li class="theo-menu-item" aria-checked="${checked === "off"}">Subtítulos Off</li>
          <li class="theo-menu-item theo-text-track-menu-item" aria-checked="${checked === "es"}">Español (ES)</li>
        </ul>
      </div>`
    return {
      player: document.querySelector<HTMLElement>(".theoplayer-skin")!,
      video: document.querySelector("video")!,
    }
  }

  it("has its subtitles on while a language is checked in its menu, in the player it names", () => {
    const on = rtvePlayer("es")
    expect(rtve.player?.(on.video)).toBe(on.player)
    expect(replacesOwn(rtve, on.video, on.player)).toBe(true)
    expect(rtve.isOn(rtvePlayer("off").video)).toBe(false)
  })

  it("keeps the subtitles above the strip of controls under the picture", () => {
    expect(rtve.host.bars(rtvePlayer("es").player).bottom).toBeCloseTo(200 + 400 * 0.12)
  })
})
