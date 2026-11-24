/** The subtitle track a video has on, as the browser holds it, whether the page's player or the browser draws it. */
import type { Cue } from "../subtitles/cues"

const SUBTITLE_KINDS = new Set(["subtitles", "captions"])

/** ArtPlayer keeps its subtitles in a metadata track, so the browser does not draw them. They are on while this matches. */
const ARTPLAYER_ON = ".art-video-player.art-subtitle-show"
const ARTPLAYER_KINDS = new Set([...SUBTITLE_KINDS, "metadata"])

/** Entities a cue's text may hold, as WebVTT writes them. */
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
  "&lrm;": "‎",
  "&rlm;": "‏",
}

/** A cue's text without its tags, like `<i>` or a speaker's `<v Anna>`, one space between words and no empty lines. */
export const plainText = (text: string): string =>
  text
    .replace(/<[^>]*>/gu, "")
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp|lrm|rlm);/gu, (entity) => ENTITIES[entity]!)
    .split("\n")
    .map((line) => line.replace(/\s+/gu, " ").trim())
    .filter((line) => line !== "")
    .join("\n")

/**
 * The track the page has on: one the browser draws, or else one it keeps hidden for the page's player to draw.
 * None means subtitles are off.
 */
export const activeTrack = (video: HTMLVideoElement): TextTrack | undefined => {
  const kinds = video.closest(ARTPLAYER_ON) === null ? SUBTITLE_KINDS : ARTPLAYER_KINDS
  const tracks = [...video.textTracks].filter(({ kind }) => kinds.has(kind))
  return tracks.find(({ mode }) => mode === "showing") ?? tracks.find(({ mode }) => mode === "hidden")
}

/**
 * `track`'s cues in the order they show, one at a time. Cues that start together, like two speakers', are one cue
 * with a line each, and an overlap ends at the next start.
 */
export const cuesOf = (track: TextTrack): Array<Cue> => {
  const cues = [...(track.cues ?? [])]
    .map((cue) => ({
      startMs: cue.startTime * 1000,
      endMs: cue.endTime * 1000,
      text: plainText("text" in cue && typeof cue.text === "string" ? cue.text : ""),
    }))
    .filter(({ text }) => text !== "")
    // Of cues that start together, the one ending first is mostly said first. The browser lists it last.
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  const together: Array<Cue> = []
  for (const cue of cues) {
    const last = together.at(-1)
    if (last !== undefined && last.startMs === cue.startMs) {
      last.endMs = Math.max(last.endMs, cue.endMs)
      last.text = `${last.text}\n${cue.text}`
    } else {
      together.push(cue)
    }
  }
  return together
    .map((cue, index) => ({ ...cue, endMs: Math.min(cue.endMs, together[index + 1]?.startMs ?? Infinity) }))
    .filter(({ startMs, endMs }) => startMs < endMs)
}
