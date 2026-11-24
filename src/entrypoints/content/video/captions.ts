/** Subtitles on any site whose videos give the browser their tracks, like Vimeo. */
import { getVideoSubtitles } from "$lib/storage"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { isFast, type Cue } from "../subtitles/cues"
import { showSubtitles, type Subtitles, type SubtitlesOptions, type Track } from "../subtitles/controller"
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
    host: VIDEO_HOST,
    isOn: getVideoSubtitles,
    keys: ["videoSubtitles"],
    frame: () => {
      const track = video?.isConnected === true ? activeTrack(video) : undefined
      // Nothing shows over a video that is itself fullscreen, so the browser draws its subtitles there.
      if (video === undefined || track === undefined || document.fullscreenElement === video) {
        dropStage()
        return undefined
      }
      const found = playerOf(video)
      if (found !== undefined) {
        dropStage()
      }
      const player = found ?? stageOver(video)
      const value = trackOf(track)
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
      if (
        current === undefined ||
        (activeTrack(current) === undefined && activeTrack(target) !== undefined)
      ) {
        video = target
        subtitles.start()
      }
    },
    { capture: true, signal: ctx.signal },
  )

  return subtitles
}
