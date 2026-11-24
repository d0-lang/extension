/** The caption tracks the YouTube player downloads, as the page's hook passes them on. */
import { TIMEDTEXT_EVENT, TIMEDTEXT_READY_EVENT, type Timedtext } from "$lib/captions"
import { fromThrowable } from "neverthrow"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { isFast, type Cue } from "../subtitles/cues"
import { cuesOf } from "./cues"
import { parseJson3 } from "./json3"

export type Track = {
  videoId: string
  /** What the cues are in. For a translation, the language YouTube translated into. */
  lang: string
  /** The track's own language, when YouTube machine-translated it. */
  translatedFrom: string | undefined
  /** Whether the track is YouTube's auto captions, or a translation of them. */
  asr: boolean
  cues: Array<Cue>
  /** Whether its cues mostly change within a couple of seconds, like quick back-and-forth dialogue. */
  fast: boolean
}

const parseJson = fromThrowable((text: string): unknown => JSON.parse(text))

const isTimedtext = (value: unknown): value is Timedtext =>
  typeof value === "object" &&
  value !== null &&
  "url" in value &&
  typeof value.url === "string" &&
  "body" in value &&
  typeof value.body === "string"

/** The track in a timedtext answer, or `undefined` when it is not one. */
export const trackOf = ({ url, body }: Timedtext): Track | undefined => {
  const params = URL.parse(url)?.searchParams
  const videoId = params?.get("v")
  const lang = params?.get("lang")
  const json3 = parseJson(body).map(parseJson3).unwrapOr(undefined)
  if (videoId == null || videoId === "" || lang == null || lang === "" || json3 === undefined) {
    return undefined
  }
  const tlang = params?.get("tlang") ?? undefined
  const asr = params?.get("kind") === "asr"
  const cues = cuesOf(json3, asr)
  return {
    videoId,
    lang: tlang ?? lang,
    translatedFrom: tlang === undefined ? undefined : lang,
    asr,
    cues,
    fast: isFast(cues),
  }
}

/** Calls `onTrack` with each caption track the player downloads, starting with the ones from before this was called. */
export const watchTracks = (ctx: ContentScriptContext, onTrack: (track: Track) => void) => {
  window.addEventListener(
    TIMEDTEXT_EVENT,
    (event) => {
      const detail = event instanceof CustomEvent && typeof event.detail === "string" ? event.detail : ""
      const track = parseJson(detail)
        .map((value) => (isTimedtext(value) ? trackOf(value) : undefined))
        .unwrapOr(undefined)
      if (track !== undefined) {
        onTrack(track)
      }
    },
    { signal: ctx.signal },
  )
  window.dispatchEvent(new CustomEvent(TIMEDTEXT_READY_EVENT))
}
