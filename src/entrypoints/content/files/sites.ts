/** Sites whose players download a subtitle file and draw it themselves, without a track the browser holds. */
import type { Host } from "$lib/subtitles/host"
import { VIDEO_HOST } from "../video/player"

export type SiteFiles = {
  /** Whether a page's host is the site's. */
  hosts: RegExp
  /** The address of a subtitle file its player downloads. */
  file: RegExp
  /** Whether the player around `video` has its subtitles on, which the extension's then show in place of. */
  isOn: (video: HTMLVideoElement) => boolean
  host: Host
}

/** ARD's player, which the box the subtitles go in can be, or hold. */
const ardPlayerOf = (player: HTMLElement): Element | null =>
  player.closest(".ardplayer") ?? player.querySelector(".ardplayer")

/**
 * ARD's controls take a quarter of the player, so the subtitles move above its seek bar only while they show. ARD
 * marks that on the player.
 */
const ARD_HOST: Host = {
  bars: (player) => {
    const idle = VIDEO_HOST.bars(player)
    const ard = ardPlayerOf(player)
    const seek = ard?.classList.contains("ardplayer-show-controls")
      ? ard.querySelector(".ardplayer-controlbar")?.getBoundingClientRect()
      : undefined
    return seek === undefined || seek.height === 0
      ? idle
      : { top: 0, bottom: Math.max(idle.bottom, player.getBoundingClientRect().bottom - seek.top) }
  },
  ownSubtitles: ".ardplayer-untertitel",
}

/**
 * ARD's player downloads EBU-TT once its subtitles are on: from ARD's API on the Mediathek, and from tagesschau.de
 * itself there.
 */
const ARD: SiteFiles = {
  hosts: /(?:^|\.)(?:ardmediathek|tagesschau)\.de$/u,
  file: /^https:\/\/(?:api\.ardmediathek\.de\/player-service\/subtitle\/ebutt\/|www\.tagesschau\.de\/.+\/ut-\d+\.xml$)/u,
  isOn: (video) => video.closest(".ardplayer")?.querySelector(".ardplayer-icon-utactive") != null,
  host: ARD_HOST,
}

const SITES: ReadonlyArray<SiteFiles> = [ARD]

/** The site `hostname` is, if its player is one of these. */
export const siteFilesOf = (hostname: string): SiteFiles | undefined =>
  SITES.find(({ hosts }) => hosts.test(hostname))
