/** Sites whose players draw the video's own track themselves, where the extension's subtitles stand in for theirs. */
import type { SubtitleSite } from "$lib/storage"
import type { Host } from "$lib/subtitles/host"
import { VIDEO_HOST } from "./player"

export type TrackSite = {
  /** Which of the switches in Integrations turns the site's subtitles on and off. */
  id: SubtitleSite
  /** Whether a page's host is the site's. */
  hosts: RegExp
  /** The subtitles show only while the player holds what it draws its own in, so a change to it never shows both. */
  host: Host & { ownSubtitles: string }
}

/**
 * NHK draws the captions of Japanese TV in a box of their own, with a canvas and an SVG. Its class names are a build's
 * hash, so the box is found by what it holds.
 */
const NHK: TrackSite = {
  id: "nhk",
  // NHK ONE is at web.nhk, NHK+ was at plus.nhk.jp, and NHK's older pages are at nhk.or.jp.
  hosts: /(?:^|\.)(?:web\.nhk|nhk\.jp|nhk\.or\.jp)$/u,
  host: { ...VIDEO_HOST, ownSubtitles: "div:has(> .tvplus-player__correction-container)" },
}

const SITES: ReadonlyArray<TrackSite> = [NHK]

/** The site `hostname` is, if its player is one of these. */
export const trackSiteOf = (hostname: string): TrackSite | undefined =>
  SITES.find(({ hosts }) => hosts.test(hostname))
