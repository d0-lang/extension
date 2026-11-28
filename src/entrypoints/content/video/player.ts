/** The player around a video on any site: where the subtitles go, and what the player draws its own in. */
import type { Host } from "$lib/subtitles/host"

/** A player box taller than its video by more than this holds more than the video, like a title under it. */
const MAX_TALLER = 1.3

/** How far up from a video a player box is looked for. */
const MAX_DEPTH = 6

/** Where the subtitles start, above the controls most players lay over the video's bottom. */
const BAR_RATIO = 0.12
const MIN_BAR_PX = 48

/**
 * The box the subtitles go in: the outermost positioned element around `video` that is still about its size. That is
 * the player, with its controls and its own subtitles, and it is what goes fullscreen. Never outside the element that
 * is fullscreen, since nothing there shows. Nothing when there is none.
 */
export const playerOf = (video: HTMLVideoElement): HTMLElement | undefined => {
  const box = video.getBoundingClientRect()
  let player: HTMLElement | undefined
  let element = video.parentElement
  for (let depth = 0; element !== null && depth < MAX_DEPTH; depth++, element = element.parentElement) {
    if (element === document.body || element.getBoundingClientRect().height > box.height * MAX_TALLER) {
      break
    }
    if (getComputedStyle(element).position !== "static") {
      player = element
    }
    if (element === document.fullscreenElement) {
      break
    }
  }
  return player
}

/** Any site's player. The selectors are where players we know draw their own subtitles from the video's tracks. */
export const VIDEO_HOST: Host = {
  bars: (player) => ({ top: 0, bottom: Math.max(MIN_BAR_PX, player.clientHeight * BAR_RATIO) }),
  // Vimeo, Plyr, ArtPlayer, and Red Bee Media's, as on TV5MONDEplus.
  ownSubtitles: ".vp-captions, .plyr__captions, .art-subtitle, .redbee-player-subtitle-container",
}
