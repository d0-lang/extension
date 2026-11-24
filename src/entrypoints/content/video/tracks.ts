/** The subtitle track a video has on, as the browser holds it, whether the page's player or the browser draws it. */
import { inOrder, type Cue } from "$lib/subtitles/cues"
import { plainText } from "$lib/subtitles/markup"

const SUBTITLE_KINDS = new Set(["subtitles", "captions"])

/** ArtPlayer keeps its subtitles in a metadata track, so the browser does not draw them. They are on while this matches. */
const ARTPLAYER_ON = ".art-video-player.art-subtitle-show"
const ARTPLAYER_KINDS = new Set([...SUBTITLE_KINDS, "metadata"])

/**
 * The track the page has on: one the browser draws, or else one it keeps hidden for the page's player to draw.
 * None means subtitles are off.
 */
export const activeTrack = (video: HTMLVideoElement): TextTrack | undefined => {
  const kinds = video.closest(ARTPLAYER_ON) === null ? SUBTITLE_KINDS : ARTPLAYER_KINDS
  const tracks = [...video.textTracks].filter(({ kind }) => kinds.has(kind))
  return tracks.find(({ mode }) => mode === "showing") ?? tracks.find(({ mode }) => mode === "hidden")
}

/** `track`'s cues as plain text, in the order they show. */
export const cuesOf = (track: TextTrack): Array<Cue> =>
  inOrder(
    [...(track.cues ?? [])].map((cue) => ({
      startMs: cue.startTime * 1000,
      endMs: cue.endTime * 1000,
      text: plainText("text" in cue && typeof cue.text === "string" ? cue.text : ""),
    })),
  )
