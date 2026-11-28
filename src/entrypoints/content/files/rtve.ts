/** RTVE Play's subtitles, which its player streams in pieces while RTVE lists a whole WebVTT file for each language. */
import { err, ok, Result } from "neverthrow"
import { z } from "zod"
import { fetchText, type SiteFile } from "./fetch"

/**
 * A piece of a video's subtitles, five seconds of WebVTT in MP4, in a folder named for its language, like
 * `…/dash_drm/es/s_125.m4s?assetid=17332713`. The video's other tracks are `a_` and `v_` pieces.
 */
export const RTVE_PIECE =
  /^https:\/\/[^/]+\.rtve\.es\/.+\/([a-z]+)\/(?:init_s|s_\d+)\.m4s\?(?:.*&)?assetid=(\d+)/u

/** The folders that are not named for the language's code: Valencian is Catalan, and Aranese is Occitan. */
const RTVE_LANGUAGES: Record<string, string> = { va: "ca", qar: "oc" }

/** The language of a subtitle piece at `url`. */
export const rtveLanguage = (url: string): string | undefined => {
  const folder = RTVE_PIECE.exec(url)?.[1]
  return folder === undefined ? undefined : (RTVE_LANGUAGES[folder] ?? folder)
}

const SubtitleList = z.object({
  page: z.object({ items: z.array(z.object({ src: z.string(), lang: z.string() })) }),
})

/** The address of the file for the language folder `lang` in RTVE's list of a video's subtitles, if it is RTVE's. */
export const listedFile = (list: string, lang: string): Result<string, Error> =>
  Result.fromThrowable(
    () => SubtitleList.parse(JSON.parse(list)),
    () => new Error("RTVE's subtitle list changed"),
  )().andThen(({ page }) => {
    const src = page.items.find((item) => item.lang === lang)?.src
    const url = src === undefined || !URL.canParse(src) ? undefined : new URL(src)
    return url?.protocol === "https:" && /(?:^|\.)rtve\.es$/u.test(url.hostname)
      ? ok(url.href)
      : err(new Error(`RTVE lists no file for ${lang}`))
  })

/** The whole file the subtitle piece at `url` is part of: its video and language, and how to read it. */
export const rtveFileOf = (url: string): SiteFile | undefined => {
  const [, lang, video] = RTVE_PIECE.exec(url) ?? []
  if (lang === undefined || video === undefined) {
    return undefined
  }
  return {
    name: `${video}/${lang}`,
    text: () =>
      fetchText(`https://api.rtve.es/api/videos/${video}/subtitulos.json`)
        .andThen((list) => listedFile(list, lang))
        .andThen(fetchText),
  }
}
