/** YouTube's subtitles, shown by the extension up to two lines at a time, each word clickable. */
import { getPauseOnLookup, getYoutubeCaptions } from "$lib/storage"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import type { WordHit } from "../page/pick"
import { cueAt } from "./cues"
import { createOverlay, type Overlay } from "./overlay"
import { adShowing, captionsOn, findPlayer, videoIdOf, videoIn } from "./player"
import { watchTracks, type Track } from "./track"

/** For videos watched earlier in the tab, because the player may not download their track again on the way back. */
const MAX_TRACKS = 20

type CaptionsOptions = {
  /** Word lookup as a whole. Without it the subtitles are YouTube's own. */
  isEnabled: () => boolean
  /** `lang` is the track's language. */
  lookUp: (hit: WordHit, lang: string) => void
}

/**
 * Shows the track the player last downloaded for the video on the page, in place of YouTube's captions.
 * It follows the CC button, hides during ads, and leaves YouTube's captions alone for tracks the hook never saw.
 */
export const showYouTubeCaptions = (ctx: ContentScriptContext, { isEnabled, lookUp }: CaptionsOptions) => {
  const tracks = new Map<string, Track>()
  let showing = true
  let pauses = true
  let overlay: Overlay | undefined
  let track: Track | undefined
  let pausedVideo: HTMLVideoElement | undefined
  let href: string | undefined
  let videoId: string | undefined
  let running = false

  const loadSettings = async () => {
    ;[showing, pauses] = await Promise.all([getYoutubeCaptions(), getPauseOnLookup()])
  }
  void loadSettings()
  browser.storage.onChanged.addListener((changes) => {
    if ("youtubeCaptions" in changes || "pauseOnLookup" in changes) {
      void loadSettings()
    }
  })

  const removeOverlay = () => {
    overlay?.remove()
    overlay = undefined
  }

  const onWord = (hit: WordHit) => {
    if (track === undefined || overlay === undefined) {
      return
    }
    lookUp(hit, track.lang)
    // After the lookup, since opening it can close the one before, which plays the video again.
    const video = videoIn(overlay.player)
    if (pauses && video !== null && !video.paused) {
      video.pause()
      pausedVideo = video
    }
  }

  const update = () => {
    // YouTube changes video without loading a new page.
    if (location.href !== href) {
      href = location.href
      videoId = videoIdOf(new URL(href))
    }
    const player = findPlayer()
    const video = player === null ? null : videoIn(player)
    track = videoId === undefined ? undefined : tracks.get(videoId)
    if (!showing || !isEnabled() || player === null || video === null || track === undefined) {
      removeOverlay()
      return
    }
    if (overlay?.player !== player) {
      removeOverlay()
      overlay = createOverlay(player, onWord)
    }
    const cue =
      captionsOn(player) && !adShowing(player) ? cueAt(track.cues, video.currentTime * 1000) : undefined
    overlay.show(cue?.text, track.lang)
  }

  const tick = () => {
    update()
    ctx.requestAnimationFrame(tick)
  }

  watchTracks(ctx, (next) => {
    // Re-adding moves it to the end, so the oldest goes first.
    tracks.delete(next.videoId)
    tracks.set(next.videoId, next)
    for (const oldest of tracks.keys()) {
      if (tracks.size <= MAX_TRACKS) {
        break
      }
      tracks.delete(oldest)
    }
    // Only pages that get a track pay for following the video.
    if (!running) {
      running = true
      tick()
    }
  })

  return {
    /** Plays the video again if a lookup paused it. */
    popoverClosed: () => {
      void pausedVideo?.play().catch(() => {})
      pausedVideo = undefined
    },
    /** Whether `event` happened on the subtitles. */
    contains: (event: Event): boolean => overlay?.contains(event) ?? false,
  }
}
