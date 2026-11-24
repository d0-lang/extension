/** Subtitles the extension shows over a video, with the one before above, each word clickable. */
import {
  DEFAULT_SUBTITLE_SETTINGS,
  getSubtitleSettings,
  SUBTITLE_KEYS,
  type SubtitleSettings,
} from "$lib/storage"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import type { WordHit } from "../page/pick"
import type { Paint } from "../popover/highlight"
import { addCopyMenu } from "./copy"
import { shownAt, type Cue } from "./cues"
import type { Host } from "./host"
import { createOverlay, removeLeftovers, type Overlay } from "./overlay"
import { keepPressFromPage } from "./press"

export type SubtitlesOptions = {
  /** Word lookup as a whole. Without it the subtitles are the site's own. */
  isEnabled: () => boolean
  /** `lang` is the track's language. */
  lookUp: (hit: WordHit, lang: string) => void
  /** Whether the open popover is the lookup of `hit`. */
  isShown: (hit: WordHit) => boolean
  /** Closes the popover. */
  close: () => void
}

/** A track's cues and their language. `fast` is whether they mostly change within a couple of seconds. */
export type Track = { lang: string; cues: ReadonlyArray<Cue>; fast: boolean }

/**
 * What a site shows now: the video, the player it plays in, and the track it has on. `hidden` is whether no cue is to
 * show for now, like during an ad. `key` names the video, since a drag places the subtitles for one video.
 */
export type Frame = {
  player: HTMLElement
  video: HTMLVideoElement
  track: Track
  hidden: boolean
  key: string | undefined
}

/** Where a site's subtitles come from. */
export type Source = {
  host: Host
  /** Whether the site's switch is on. Read again when one of `keys` changes in storage. */
  isOn: () => Promise<boolean>
  keys: ReadonlyArray<string>
  /** What shows now, or `undefined` when the extension's subtitles are not to show, leaving the site's own. */
  frame: () => Frame | undefined
}

/**
 * Shows the subtitles `source` finds, in place of the site's own, once `start` is called. A lookup pauses the video
 * until its popover closes.
 */
export const showSubtitles = (
  ctx: ContentScriptContext,
  { isEnabled, lookUp, isShown, close }: SubtitlesOptions,
  source: Source,
) => {
  let on = true
  let settings: SubtitleSettings = DEFAULT_SUBTITLE_SETTINGS
  let copyMenu: ReturnType<typeof addCopyMenu> | undefined
  /** Whether the overlay slides, which depends on the track as well as the settings. */
  let overlaySlides: boolean | undefined
  let overlay: Overlay | undefined
  let frame: Frame | undefined
  let key: string | undefined
  let pausedVideo: HTMLVideoElement | undefined
  /** Ends the wait for `pausedVideo` to play by other means, like the space key. */
  let stopWatchingPlay: AbortController | undefined
  let running = false

  const removeOverlay = () => {
    copyMenu?.remove()
    copyMenu = undefined
    overlay?.remove()
    overlay = undefined
  }
  // An overlay left behind by a reloaded extension would keep the site's own subtitles hidden.
  removeLeftovers()
  ctx.onInvalidated(removeOverlay)

  const loadSettings = async () => {
    const [isOn, subtitles] = await Promise.all([source.isOn(), getSubtitleSettings()])
    on = isOn
    if (JSON.stringify(subtitles) !== JSON.stringify(settings)) {
      settings = subtitles
      // Drawn again with the new settings on the next frame.
      removeOverlay()
    }
  }
  void loadSettings()
  browser.storage.onChanged.addListener((changes) => {
    if ([...source.keys, ...SUBTITLE_KEYS].some((name) => name in changes)) {
      void loadSettings()
    }
  })

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

  const onWord = (hit: WordHit) => {
    if (frame === undefined || overlay === undefined) {
      return
    }
    // Clicking the word again, or another word its match covers, closes its lookup, which plays the video again.
    if (isShown(hit) || overlay.isMarked(hit)) {
      close()
      return
    }
    lookUp(hit, frame.track.lang)
    // After the lookup, since opening it can close the one before, which plays the video again.
    const { video } = frame
    if (!video.paused) {
      video.pause()
      pausedVideo = video
      watchPlay(video)
    }
  }

  const update = () => {
    frame = on && isEnabled() ? source.frame() : undefined
    if (frame?.key !== undefined && frame.key !== key) {
      key = frame.key
      overlay?.resetPosition()
    }
    // The overlay hides the site's own subtitles while it is there, so it goes when the extension's are not to show.
    if (frame === undefined) {
      removeOverlay()
      return
    }
    const { player, video, track, hidden } = frame
    // A fast track shows without the slide, so its subtitles do not keep moving.
    const slide = settings.slide && !(settings.calm && track.fast)
    if (overlay?.player !== player || overlaySlides !== slide) {
      removeOverlay()
      overlay = createOverlay(ctx, player, source.host, onWord, { ...settings, slide })
      copyMenu = addCopyMenu(ctx, overlay)
      overlaySlides = slide
    }
    overlay.show(
      hidden ? undefined : shownAt(track.cues, video.currentTime * 1000, settings.styles),
      track.lang,
    )
  }

  const tick = () => {
    update()
    ctx.requestAnimationFrame(tick)
  }

  return {
    /** Starts following the video. Only pages with subtitles to show pay for it. */
    start: () => {
      if (!running) {
        running = true
        tick()
      }
    },
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

export type Subtitles = ReturnType<typeof showSubtitles>
