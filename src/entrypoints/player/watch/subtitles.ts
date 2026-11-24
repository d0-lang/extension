/** A subtitle file's cues over the player's video. */
import { showSubtitles, type Subtitles, type SubtitlesOptions, type Track } from "$lib/subtitles/controller"
import type { Host } from "$lib/subtitles/host"
import type { ContentScriptContext } from "wxt/utils/content-script-context"

/** The player's own controls, kept clear of the subtitles. */
const PLAYER_HOST: Host = {
  bars: (player) => ({
    top: 0,
    bottom: player.querySelector<HTMLElement>("[data-controls]")?.offsetHeight ?? 0,
  }),
}

/** What plays now. `key` names the video, since a drag places the subtitles for one video. */
export type Playing = { player: HTMLElement; video: HTMLVideoElement; track: Track; key: string }

/** Shows the cues of what `playing` gives, once `start` is called. Nothing shows while it gives nothing. */
export const showFileSubtitles = (
  ctx: ContentScriptContext,
  options: SubtitlesOptions,
  playing: () => Playing | undefined,
): Subtitles =>
  showSubtitles(ctx, options, {
    host: PLAYER_HOST,
    // The page is opened to watch with them, so no switch turns them off.
    isOn: () => Promise.resolve(true),
    keys: [],
    frame: () => {
      const now = playing()
      return now === undefined ? undefined : { ...now, hidden: false }
    },
  })
