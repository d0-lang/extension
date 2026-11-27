/** The subtitle file a site's player downloads, read as the page loads it. */
import { errAsync, ResultAsync } from "neverthrow"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { toError } from "$lib/errors"
import { isFast } from "$lib/subtitles/cues"
import type { Track } from "$lib/subtitles/controller"
import type { SiteFiles } from "./sites"
import { readTtml, ttmlLanguage } from "./ttml"

const fetchText = (url: string): ResultAsync<string, Error> =>
  ResultAsync.fromPromise(fetch(url), toError).andThen((response) =>
    response.ok
      ? ResultAsync.fromPromise(response.text(), toError)
      : errAsync(new Error(`HTTP ${response.status}`)),
  )

/** `text` of a TTML file as a track, in the page's language when the file names none. */
const trackOf = (text: string): Track => {
  const doc = new DOMParser().parseFromString(text, "application/xml")
  const cues = readTtml(doc)
  const lang = ttmlLanguage(doc) ?? document.documentElement.lang.split("-")[0] ?? ""
  return { lang, cues, fast: isFast(cues) }
}

/** A request the player made for a file, by when it started. */
type Request = { url: string; start: number; failed: boolean }

/**
 * Whether the player's request for `url` at `start` is to be read, after `latest`. Requests can finish, and be
 * reported, in another order than the player made them, so an older one is not. The player asks again for the file it
 * has when its subtitles go back on, which needs no second read unless the first failed.
 */
export const isNewRequest = (latest: Request | undefined, url: string, start: number): boolean =>
  latest === undefined || (start >= latest.start && (url !== latest.url || latest.failed))

/**
 * Reads each subtitle file of `site` the page loads, which its player does when its subtitles go on. The file the
 * player asked for last is the track, and none is while it loads, so another video's cues never show over this one.
 */
export const watchSiteFiles = (
  ctx: ContentScriptContext,
  site: SiteFiles,
): { track: () => Track | undefined } => {
  let track: Track | undefined
  let latest: Request | undefined

  const read = (url: string, start: number) => {
    const request: Request = { url, start, failed: false }
    latest = request
    track = undefined
    void fetchText(url).match(
      (text) => {
        if (latest === request) {
          track = trackOf(text)
        }
      },
      (error) => {
        console.warn("Could not read the subtitle file", url, error)
        request.failed = true
      },
    )
  }

  const observer = new PerformanceObserver((entries) => {
    for (const { name, startTime } of entries.getEntries()) {
      if (site.file.test(name) && isNewRequest(latest, name, startTime)) {
        read(name, startTime)
      }
    }
  })
  observer.observe({ type: "resource", buffered: true })
  ctx.onInvalidated(() => observer.disconnect())

  return { track: () => track }
}
