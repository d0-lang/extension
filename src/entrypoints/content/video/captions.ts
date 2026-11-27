/** Subtitles on any site whose videos give the browser their tracks, like Vimeo, or whose player downloads a file we read. */
import { getSiteSubtitles, getVideoSubtitles, siteSubtitlesKey } from "$lib/storage"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { isFast, type Cue } from "$lib/subtitles/cues"
import { showSubtitles, type Subtitles, type SubtitlesOptions, type Track } from "$lib/subtitles/controller"
import { replacesOwn, siteFilesOf } from "../files/sites"
import { watchSiteFiles } from "../files/watch"
import { playerOf, VIDEO_HOST } from "./player"
import { createStage, removeStages, type Stage } from "./stage"
import { activeTrack, cuesOf } from "./tracks"

/**
 * Shows the subtitles of the video that plays, from the track its page has on, in place of the page's own.
 * Pages whose videos never play pay nothing.
 */
export const showVideoSubtitles = (ctx: ContentScriptContext, options: SubtitlesOptions): Subtitles => {
  let video: HTMLVideoElement | undefined
  /** The cues read last, read again when the page adds cues to its track as the video goes on. */
  let read: { track: TextTrack; count: number; value: Track } | undefined

  const trackOf = (track: TextTrack): Track => {
    const count = track.cues?.length ?? 0
    if (read?.track !== track || read.count !== count) {
      const cues: Array<Cue> = cuesOf(track)
      read = { track, count, value: { lang: track.language, cues, fast: isFast(cues) } }
    }
    return read.value
  }

  const site = siteFilesOf(location.hostname)
  /** The box the subtitles go in: the one the site names, or the one around the video about its size. */
  const playerAround = (over: HTMLVideoElement): HTMLElement | undefined =>
    site?.player?.(over) ?? playerOf(over)
  const files = site === undefined ? undefined : watchSiteFiles(ctx, site)

  /** The track the page has on, or else the file its player downloaded, while the player has its subtitles on. */
  const trackFor = (over: HTMLVideoElement): Track | undefined => {
    const track = activeTrack(over)
    if (track !== undefined) {
      return trackOf(track)
    }
    return site !== undefined && replacesOwn(site, over, playerAround(over)) ? files?.track() : undefined
  }
  const hasSubtitles = (over: HTMLVideoElement): boolean =>
    activeTrack(over) !== undefined || site?.isOn(over) === true

  /** Over a video with no player box around it. */
  let stage: Stage | undefined
  const dropStage = () => {
    stage?.remove()
    stage = undefined
  }
  const stageOver = (over: HTMLVideoElement): HTMLElement => {
    if (stage?.video !== over) {
      dropStage()
      stage = createStage(over)
    }
    stage.follow()
    return stage.element
  }
  removeStages()
  ctx.onInvalidated(dropStage)

  const subtitles = showSubtitles(ctx, options, {
    host: site?.host ?? VIDEO_HOST,
    // A site the extension reads files on has its own switch, as nothing else shows subtitles there.
    isOn: site === undefined ? getVideoSubtitles : () => getSiteSubtitles(site.id),
    keys: [site === undefined ? "videoSubtitles" : siteSubtitlesKey(site.id)],
    frame: () => {
      const value = video?.isConnected === true ? trackFor(video) : undefined
      // Nothing shows over a video that is itself fullscreen, so the browser draws its subtitles there.
      if (video === undefined || value === undefined || document.fullscreenElement === video) {
        dropStage()
        return undefined
      }
      const found = playerAround(video)
      if (found !== undefined) {
        dropStage()
      }
      const player = found ?? stageOver(video)
      return value.cues.length === 0
        ? undefined
        : { player, video, track: value, hidden: false, key: video.currentSrc }
    },
  })

  // A video that plays sends these a few times a second, so one that started before this script did is found too.
  // Media events do not bubble, but they pass the document on their way down.
  document.addEventListener(
    "timeupdate",
    ({ target }) => {
      if (!(target instanceof HTMLVideoElement) || target === video) {
        return
      }
      // Another video that plays at the same time, like a muted preview, takes over only from one without subtitles.
      const current = video?.isConnected === true && !video.paused ? video : undefined
      if (current === undefined || (!hasSubtitles(current) && hasSubtitles(target))) {
        video = target
        subtitles.start()
      }
    },
    { capture: true, signal: ctx.signal },
  )

  return subtitles
}
