/** YouTube's subtitles, shown by the extension up to two lines at a time, each word clickable. */
import { ORIGINAL_ATTRIBUTE } from "$lib/captions"
import { getLookupEnabled, getYoutubeCaptions } from "$lib/storage"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import type { WordHit } from "../page/pick"
import { cueAt } from "./cues"
import type { Paint } from "../popover/highlight"
import { createOverlay, removeLeftovers, type Overlay } from "./overlay"
import { adShowing, captionsOn, findPlayer, videoIdOf, videoIn } from "./player"
import { keepPressFromPage } from "./press"
import { watchTracks, type Track } from "./track"

/** For videos watched earlier in the tab, because the player may not download their track again on the way back. */
const MAX_TRACKS = 20

type CaptionsOptions = {
  /** Word lookup as a whole. Without it the subtitles are YouTube's own. */
  isEnabled: () => boolean
  /** `lang` is the track's language. */
  lookUp: (hit: WordHit, lang: string) => void
  /** Whether the open popover is the lookup of `hit`. */
  isShown: (hit: WordHit) => boolean
  /** Closes the popover. */
  close: () => void
}

/**
 * Shows the track the player last downloaded for the video on the page, in place of YouTube's captions.
 * It follows the CC button, hides during ads, and leaves YouTube's captions alone for tracks the hook never saw
 * and in players without the button, like the one for Shorts.
 * While on, it also has the page's world undo the audio and captions YouTube picks from the viewer's language.
 */
export const showYouTubeCaptions = (
  ctx: ContentScriptContext,
  { isEnabled, lookUp, isShown, close }: CaptionsOptions,
) => {
  const tracks = new Map<string, Track>()
  let showing = true
  let overlay: Overlay | undefined
  let track: Track | undefined
  let pausedVideo: HTMLVideoElement | undefined
  /** Ends the wait for `pausedVideo` to play by other means, like the space key. */
  let stopWatchingPlay: AbortController | undefined
  let href: string | undefined
  let videoId: string | undefined
  let running = false

  const loadSettings = async () => {
    const [youtube, lookup] = await Promise.all([getYoutubeCaptions(), getLookupEnabled()])
    showing = youtube
    document.documentElement.toggleAttribute(ORIGINAL_ATTRIBUTE, youtube && lookup)
  }
  void loadSettings()
  browser.storage.onChanged.addListener((changes) => {
    if ("youtubeCaptions" in changes || "lookupEnabled" in changes) {
      void loadSettings()
    }
  })

  const removeOverlay = () => {
    overlay?.remove()
    overlay = undefined
  }
  // An overlay left behind by a reloaded extension would keep YouTube's own captions hidden.
  removeLeftovers()
  ctx.onInvalidated(removeOverlay)

  const onWord = (hit: WordHit) => {
    if (track === undefined || overlay === undefined) {
      return
    }
    // Clicking the word again closes its lookup, which plays the video again.
    if (isShown(hit)) {
      close()
      return
    }
    lookUp(hit, track.lang)
    // After the lookup, since opening it can close the one before, which plays the video again.
    const video = videoIn(overlay.player)
    if (video !== null && !video.paused) {
      video.pause()
      pausedVideo = video
      watchPlay(video)
    }
  }

  /** Closes the lookup once `video` plays again, since the lookup is what paused it. */
  const watchPlay = (video: HTMLVideoElement) => {
    stopWatchingPlay?.abort()
    stopWatchingPlay = new AbortController()
    video.addEventListener(
      "play",
      () => {
        // A `play` queued just before the pause arrives after it, with the video paused again.
        if (!video.paused) {
          close()
        }
      },
      { signal: AbortSignal.any([stopWatchingPlay.signal, ctx.signal]) },
    )
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
    // The overlay hides YouTube's captions while it is there, so it goes when ours are not to show.
    if (
      !showing ||
      !isEnabled() ||
      player === null ||
      video === null ||
      track === undefined ||
      !captionsOn(player)
    ) {
      removeOverlay()
      return
    }
    if (overlay?.player !== player) {
      removeOverlay()
      overlay = createOverlay(player, onWord)
    }
    const cue = adShowing(player) ? undefined : cueAt(track.cues, video.currentTime * 1000)
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
      stopWatchingPlay?.abort()
      stopWatchingPlay = undefined
      void pausedVideo?.play().catch(() => {})
      pausedVideo = undefined
    },
    /**
     * Keeps a press on the player that closes the popover from the player, while a lookup keeps the video paused.
     * Closing plays the video, and the player would take the press as a pause.
     */
    keepClosingPress: (event: PointerEvent) => {
      if (
        pausedVideo !== undefined &&
        overlay !== undefined &&
        event.composedPath().includes(overlay.player)
      ) {
        keepPressFromPage(ctx, event)
      }
    },
    /** Whether `event` happened on the subtitles. */
    contains: (event: Event): boolean => overlay?.contains(event) ?? false,
    /** How to mark words around `node`, when it is in the subtitles. */
    markFor: (node: Node): Paint | undefined => (overlay?.holds(node) === true ? overlay.mark : undefined),
  }
}
