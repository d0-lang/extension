/** YouTube's subtitles, shown by the extension in place of the player's own. */
import { ORIGINAL_ATTRIBUTE } from "$lib/captions"
import { getLookupEnabled, getYoutubeCaptions } from "$lib/storage"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { showSubtitles, type Subtitles, type SubtitlesOptions } from "../subtitles/controller"
import { adShowing, captionsOn, findPlayer, videoIdOf, videoIn, YOUTUBE_HOST } from "./player"
import { watchTracks, type Track } from "./track"

/** For videos watched earlier in the tab, because the player may not download their track again on the way back. */
const MAX_TRACKS = 20

/**
 * Shows the track the player last downloaded for the video on the page, in place of YouTube's captions.
 * It follows the CC button, hides during ads, and leaves YouTube's captions alone for tracks the hook never saw
 * and in players without the button, like the one for Shorts.
 * While on, it also has the page's world undo the audio and captions YouTube picks from the viewer's language.
 */
export const showYouTubeCaptions = (ctx: ContentScriptContext, options: SubtitlesOptions): Subtitles => {
  const tracks = new Map<string, Track>()
  let href: string | undefined
  let videoId: string | undefined

  const markOriginal = async () => {
    const [youtube, lookup] = await Promise.all([getYoutubeCaptions(), getLookupEnabled()])
    document.documentElement.toggleAttribute(ORIGINAL_ATTRIBUTE, youtube && lookup)
  }
  void markOriginal()
  browser.storage.onChanged.addListener((changes) => {
    if ("youtubeCaptions" in changes || "lookupEnabled" in changes) {
      void markOriginal()
    }
  })

  const subtitles = showSubtitles(ctx, options, {
    host: YOUTUBE_HOST,
    isOn: getYoutubeCaptions,
    keys: ["youtubeCaptions"],
    frame: () => {
      // YouTube changes video without loading a new page.
      if (location.href !== href) {
        href = location.href
        videoId = videoIdOf(new URL(href))
      }
      const player = findPlayer()
      const video = player === null ? null : videoIn(player)
      const track = videoId === undefined ? undefined : tracks.get(videoId)
      return player === null || video === null || track === undefined || !captionsOn(player)
        ? undefined
        : { player, video, track, hidden: adShowing(player), key: videoId }
    },
  })

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
    subtitles.start()
  })

  return subtitles
}
