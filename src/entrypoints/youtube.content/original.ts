/** Undoes the languages YouTube picks from the viewer's own: dubbed audio, and subtitles in a language the video is not spoken in. */

/** An audio track as the player API gives it. Its details sit under a key the player's build renames, so they are found by shape. */
export type AudioTrack = { id: string }
type AudioDetails = { id: string; isAutoDubbed: boolean }

/** A caption track as the player API gives it. */
export type CaptionTrack = { languageCode: string; kind: string; translationLanguage?: unknown }

type Player = HTMLElement & {
  getVideoData?: () => { video_id?: string } | undefined
  getAvailableAudioTracks?: () => Array<AudioTrack> | undefined
  getAudioTrack?: () => AudioTrack | undefined
  setAudioTrack?: (track: AudioTrack) => void
  getOption?: (module: string, option: string, args?: object) => unknown
  setOption?: (module: string, option: string, value: unknown) => void
}

/** Often enough to act before much of the video plays, and cheap enough to run on every YouTube page. */
const CHECK_MS = 1000

const baseLanguage = (code: string): string => code.split(/[-_.]/u)[0]!.toLowerCase()

const detailsOf = (track: AudioTrack): AudioDetails | undefined =>
  Object.values(track as Record<string, unknown>).find(
    (value: unknown): value is AudioDetails =>
      typeof value === "object" && value !== null && "isAutoDubbed" in value && "id" in value,
  )

/** Its id carries the track's kind, `original` or `dubbed-auto`, in base64 after the `;`. */
const markedOriginal = (track: AudioTrack): boolean => {
  const encoded = track.id.split(";")[1]
  if (encoded === undefined) {
    return false
  }
  try {
    return atob(encoded.replace(/-/gu, "+").replace(/_/gu, "/")).includes("original")
  } catch {
    // Not base64, so it says nothing either way.
    return false
  }
}

/** The audio the video was made with: the track marked original, else the first that is not dubbed. */
export const originalAudio = (tracks: ReadonlyArray<AudioTrack>): AudioTrack | undefined => {
  const undubbed = tracks.filter((track) => detailsOf(track)?.isAutoDubbed === false)
  return undubbed.find(markedOriginal) ?? undubbed[0]
}

/** What the video is spoken in: its original audio's language, else the language of its auto captions, which are made from the audio. */
export const spokenLanguage = (
  audio: ReadonlyArray<AudioTrack>,
  captions: ReadonlyArray<CaptionTrack>,
): string | undefined => {
  const original = audio.length > 1 ? originalAudio(audio) : undefined
  const fromAudio = original === undefined ? undefined : detailsOf(original)?.id
  const asr = captions.find(({ kind }) => kind === "asr")?.languageCode
  const code = fromAudio ?? asr
  return code === undefined ? undefined : baseLanguage(code)
}

/** The track to switch to from `current`: the creator's in the spoken language, else the auto one. Unset when `current` already is in it. */
export const captionsFor = (
  current: CaptionTrack,
  tracks: ReadonlyArray<CaptionTrack>,
  spoken: string | undefined,
): CaptionTrack | undefined => {
  if (
    spoken === undefined ||
    (!current.translationLanguage && baseLanguage(current.languageCode) === spoken)
  ) {
    return undefined
  }
  const inSpoken = tracks.filter(({ languageCode }) => baseLanguage(languageCode) === spoken)
  return inSpoken.find(({ kind }) => kind !== "asr") ?? inSpoken[0]
}

/**
 * Once per video, while `isOn`: plays the original audio over an auto-dub, and turns captions in another language
 * to the spoken one. Only YouTube's own pick is undone, so a choice the viewer makes afterwards stays.
 */
export const keepOriginal = (isOn: () => boolean) => {
  let audioDone: string | undefined
  let captionsDone: string | undefined
  window.setInterval(() => {
    const player = document.querySelector<Player>("#movie_player")
    // An ad has video data of its own.
    if (!isOn() || player === null || player.classList.contains("ad-showing")) {
      return
    }
    const videoId = player.getVideoData?.()?.video_id
    if (videoId === undefined || videoId === "") {
      return
    }
    const audio = player.getAvailableAudioTracks?.() ?? []
    if (audioDone !== videoId && audio.length > 0) {
      audioDone = videoId
      const current = player.getAudioTrack?.()
      const original = originalAudio(audio)
      if (current !== undefined && detailsOf(current)?.isAutoDubbed === true && original !== undefined) {
        player.setAudioTrack?.(original)
      }
    }
    if (captionsDone !== videoId) {
      const current = player.getOption?.("captions", "track") as CaptionTrack | undefined
      const tracks = player.getOption?.("captions", "tracklist", { includeAsr: true })
      // Captions are off, or not loaded yet. YouTube picks a track when they come on, so that is checked then.
      if (current?.languageCode === undefined || current.languageCode === "" || !Array.isArray(tracks)) {
        return
      }
      captionsDone = videoId
      const next = captionsFor(
        current,
        tracks as Array<CaptionTrack>,
        spokenLanguage(audio, tracks as Array<CaptionTrack>),
      )
      if (next !== undefined) {
        player.setOption?.("captions", "track", next)
      }
    }
  }, CHECK_MS)
}
