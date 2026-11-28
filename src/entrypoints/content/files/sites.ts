/** Sites whose players download a subtitle file and draw it themselves, without a track the browser holds. */
import type { SubtitleSite } from "$lib/storage"
import type { Host } from "$lib/subtitles/host"
import { VIDEO_HOST } from "../video/player"
import type { SiteFile } from "./fetch"
import { rtveFileOf, rtveLanguage, RTVE_PIECE } from "./rtve"

export type SiteFiles = {
  /** Which of the switches in Integrations turns the site's subtitles on and off. */
  id: SubtitleSite
  /** Whether a page's host is the site's. */
  hosts: RegExp
  /** The address of a subtitle file its player downloads. */
  file: RegExp
  format: "ttml" | "webvtt"
  /**
   * For a player that streams its subtitles in pieces, which `file` then matches: the whole file a piece at `url` is
   * part of, named the same for every piece of it, and how to read it.
   */
  wholeFile?: (url: string) => SiteFile | undefined
  /** The language of the file at an address, for a format that does not name it. */
  lang?: (url: string) => string | undefined
  /** The box the subtitles go in, for a player whose box is not the one around `video` that is about its size. */
  player?: (video: HTMLVideoElement) => HTMLElement | undefined
  /** Whether the player around `video` has its subtitles on, which the extension's then show in place of. */
  isOn: (video: HTMLVideoElement) => boolean
  /** The subtitles show only while the player holds what it draws its own in, so a change to it never shows both. */
  host: Host & { ownSubtitles: string }
}

/**
 * The bars to keep clear: the generic ones, or up to the top of the player's `bar` while it shows, so the subtitles
 * move above it only then.
 */
const clearOf = (player: HTMLElement, bar: Element | null | undefined): { top: number; bottom: number } => {
  const idle = VIDEO_HOST.bars(player)
  const box = bar?.getBoundingClientRect()
  return box === undefined || box.height === 0
    ? idle
    : { top: 0, bottom: Math.max(idle.bottom, player.getBoundingClientRect().bottom - box.top) }
}

/** ARD's player, which the box the subtitles go in can be, or hold. */
const ardPlayerOf = (player: HTMLElement): Element | null =>
  player.closest(".ardplayer") ?? player.querySelector(".ardplayer")

/**
 * ARD's controls take a quarter of the player, so the subtitles move above its seek bar only while they show. ARD
 * marks that on the player.
 */
const ARD_HOST: SiteFiles["host"] = {
  bars: (player) => {
    const ard = ardPlayerOf(player)
    return clearOf(
      player,
      ard?.classList.contains("ardplayer-show-controls")
        ? ard.querySelector(".ardplayer-controlbar")
        : undefined,
    )
  },
  ownSubtitles: ".ardplayer-untertitel",
  // The bars, the big play button and the shade behind them.
  ownControls: ".ardplayer-header, .ardplayer-center, .ardplayer-footer, .ardplayer-background",
}

/**
 * ARD's player downloads EBU-TT once its subtitles are on: from ARD's API on the Mediathek, and from tagesschau.de
 * itself there.
 */
const ARD: SiteFiles = {
  id: "ard",
  hosts: /(?:^|\.)(?:ardmediathek|tagesschau)\.de$/u,
  file: /^https:\/\/(?:api\.ardmediathek\.de\/player-service\/subtitle\/ebutt\/|www\.tagesschau\.de\/.+\/ut-\d+\.xml$)/u,
  format: "ttml",
  isOn: (video) => video.closest(".ardplayer")?.querySelector(".ardplayer-icon-utactive") != null,
  host: ARD_HOST,
}

/** Arte's controls fade in and out together, its seek bar along the bottom, and it marks them shown on the player. */
const ARTE_HOST: SiteFiles["host"] = {
  bars: (player) =>
    clearOf(player, player.matches(".showControls") ? player.querySelector(".avp-controlbar") : undefined),
  // video.js draws them, as Arte's player is built on it.
  ownSubtitles: ".vjs-text-track-display",
  ownControls: ".avp-content",
  // The controls' own backing darkens the whole video whenever the mouse moves over it.
  ownShade: ".avp-content",
}

/** The subtitles the viewer last picked in Arte's menu, like `en-subtitles`, as Arte keeps them in the page's storage. */
const storedArteCaption = (): string | undefined => {
  try {
    return localStorage.getItem("arte_vp.userPreferredCaption") ?? undefined
  } catch {
    return undefined
  }
}

/** The languages of Arte's subtitle versions, like `ANG` in `VO-ANG`. */
const ARTE_LANGUAGES: Record<string, string> = {
  DEU: "de",
  ALL: "de",
  FRA: "fr",
  ANG: "en",
  ESP: "es",
  POL: "pl",
  ITA: "it",
}

/** The language of the dubbed or original version, for subtitles named for whom they are, like `MAL` in `VA-MAL`. */
const ARTE_VERSIONS: Record<string, string> = { VA: "de", VOA: "de", VF: "fr", VOF: "fr" }

/**
 * Arte's player is video.js, which keeps the cues to itself. Picking subtitles in its language menu downloads a whole
 * WebVTT file, named for its version, like `…_st_VO-ANG_….vtt` for English.
 */
const ARTE: SiteFiles = {
  id: "arte",
  hosts: /(?:^|\.)arte\.tv$/u,
  file: /^https:\/\/arte-cmafhls\.akamaized\.net\/.+_st_[^/]+\.vtt$/u,
  format: "webvtt",
  lang: (url) => {
    const [, version = "", language = ""] = /_st_([A-Z]+)-([A-Z]+)_/u.exec(url) ?? []
    return ARTE_LANGUAGES[language] ?? ARTE_VERSIONS[version]
  },
  // The box around the video is taller than the player, so the player is named.
  player: (video) => video.closest<HTMLElement>(".avp-player") ?? undefined,
  // Arte keeps the viewer's pick from its menu, which is gone once it closes. "none" is its automatic choice.
  isOn: () => {
    const picked = storedArteCaption()
    return picked !== undefined && picked !== "none"
  },
  host: ARTE_HOST,
}

/**
 * ZDF's controls show while the player is not idle. Its own class names end in a build's hash, so they are matched
 * by how they start.
 */
const ZDF_HOST: SiteFiles["host"] = {
  bars: (player) =>
    clearOf(
      player,
      player.matches(".zdfplayer-idle") ? undefined : player.querySelector('[class*="bottom-controls-"]'),
    ),
  ownSubtitles: ".zdfplayer-subtitles-unscoped",
  // The bars, the buttons in the middle, and the shade behind them.
  ownControls:
    '[class*="top-controls-container-"], [class*="center-controls-"], [class*="bottom-controls-"], .zdfplayer-dimmer',
}

/** ZDF's player downloads EBU-TT once its subtitles are picked in its language settings. */
const ZDF: SiteFiles = {
  id: "zdf",
  hosts: /(?:^|\.)zdf\.de$/u,
  file: /^https:\/\/utstreaming\.zdf\.de\/mtt\/.+\.xml$/u,
  format: "ttml",
  player: (video) => video.closest<HTMLElement>(".zdfplayer-app") ?? undefined,
  // Its language settings stay in the player when closed, with "off" as a choice.
  isOn: (video) => {
    const picked = video
      .closest(".zdfplayer-app")
      ?.querySelector<HTMLInputElement>('input[name="subtitles"]:checked')
    return picked != null && picked.value !== "off"
  },
  host: ZDF_HOST,
}

/**
 * Once a video starts, RTVE shortens the picture for a strip of controls under it, so the subtitles keep clear of all
 * of it. In fullscreen, the controls are over the picture.
 */
const RTVE_HOST: SiteFiles["host"] = {
  bars: (player) => {
    const picture = player.querySelector<HTMLElement>(".vjs-tech") ?? player
    const strip = player.getBoundingClientRect().bottom - picture.getBoundingClientRect().bottom
    return { top: 0, bottom: Math.max(0, strip) + VIDEO_HOST.bars(picture).bottom }
  },
  ownSubtitles: ".theoplayer-texttracks",
  // The bars, the skip buttons and the play button that covers the whole player.
  ownControls: ".vjs-control-bar",
  // Its shade stops at the seek bar, and is darkest right behind the subtitles.
  ownShade: ".theo-player-wrapper",
  // In fullscreen, a second play button sits between the skip buttons, over the picture, where the subtitles go.
  inTheWay: ".custom-big-play-pause-button",
}

/** RTVE Play's player is THEOplayer, in a video.js skin, which streams the subtitles picked in its menu in pieces. */
const RTVE: SiteFiles = {
  id: "rtve",
  hosts: /(?:^|\.)rtve\.es$/u,
  file: RTVE_PIECE,
  format: "webvtt",
  wholeFile: rtveFileOf,
  lang: rtveLanguage,
  // The box around the video is the picture alone, without the strip of controls under it.
  player: (video) => video.closest<HTMLElement>(".theoplayer-skin") ?? undefined,
  // Its menu stays in the player when closed, with one language checked, or "off".
  isOn: (video) =>
    video.closest(".theoplayer-skin")?.querySelector('.theo-text-track-menu-item[aria-checked="true"]') !=
    null,
  host: RTVE_HOST,
}

const SITES: ReadonlyArray<SiteFiles> = [ARD, ARTE, ZDF, RTVE]

/** The site `hostname` is, if its player is one of these. */
export const siteFilesOf = (hostname: string): SiteFiles | undefined =>
  SITES.find(({ hosts }) => hosts.test(hostname))

/**
 * Whether the file shows in place of the subtitles of the player around `video`: while they are on, and only while
 * `player` holds what it draws them in. After a change to the player, the page shows its own rather than both.
 */
export const replacesOwn = (
  site: SiteFiles,
  video: HTMLVideoElement,
  player: HTMLElement | undefined,
): boolean => player?.querySelector(site.host.ownSubtitles) != null && site.isOn(video)
