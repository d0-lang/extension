/** The subtitle track a video has on, as the browser holds it, whether the page's player or the browser draws it. */
import { inOrder, type Cue } from "$lib/subtitles/cues"
import type { Styled } from "$lib/subtitles/rows"
import { plainText, styledText } from "$lib/subtitles/markup"
import { aribMarkup, isArib } from "./arib"

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

/** A cue's text as plain text, or with its colours when it comes from Japanese TV, which names them by command. */
const textOf = (text: string): Styled =>
  isArib(text) ? styledText(aribMarkup(text)) : { text: plainText(text) }

/** `track`'s cues, in the order they show. */
export const cuesOf = (track: TextTrack): Array<Cue> =>
  inOrder(
    [...(track.cues ?? [])].map((cue) => ({
      startMs: cue.startTime * 1000,
      endMs: cue.endTime * 1000,
      ...textOf("text" in cue && typeof cue.text === "string" ? cue.text : ""),
    })),
  )
