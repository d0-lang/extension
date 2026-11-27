/** The subtitle file a site's player downloads, read as the page loads it. */
import { errAsync, ResultAsync } from "neverthrow"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { toError } from "$lib/errors"
import { inOrder, isFast, type Cue } from "$lib/subtitles/cues"
import { readTimed } from "$lib/subtitles/timed"
import type { Track } from "$lib/subtitles/controller"
import type { SiteFiles } from "./sites"
import { readTtml, ttmlLanguage } from "./ttml"

const fetchText = (url: string): ResultAsync<string, Error> =>
  ResultAsync.fromPromise(fetch(url), toError).andThen((response) =>
    response.ok
      ? ResultAsync.fromPromise(response.text(), toError)
      : errAsync(new Error(`HTTP ${response.status}`)),
  )

/** The cues of a file in `format`, and the language it names, if it names one. */
const cuesOf = (
  text: string,
  format: SiteFiles["format"],
): { cues: Array<Cue>; lang: string | undefined } => {
  if (format === "webvtt") {
    return { cues: inOrder(readTimed(text)), lang: undefined }
  }
  const doc = new DOMParser().parseFromString(text, "application/xml")
  return { cues: readTtml(doc), lang: ttmlLanguage(doc) }
}

/** `text` of `site`'s file at `url` as a track, in the language the file or its address names, or else the page's. */
const trackOf = (text: string, site: SiteFiles, url: string): Track => {
  const { cues, lang } = cuesOf(text, site.format)
  return {
    lang: lang ?? site.lang?.(url) ?? document.documentElement.lang.split("-")[0] ?? "",
    cues,
    fast: isFast(cues),
  }
}

/** A read of a file the player asked for, and when it last asked for it. */
type Request = { url: string; start: number; failed: boolean; read: number }

/**
 * The player's latest request once it asks for `url` at `start`, and whether that file is to be read, as the `read`th
 * read. Requests can finish, and be reported, in another order than the player made them, so an older one changes
 * nothing. The player asks again for the file it has when its subtitles go back on, which needs no second read unless
 * the first failed, but is the latest request from then on.
 */
export const requested = (
  latest: Request | undefined,
  url: string,
  start: number,
  read: number,
): { latest: Request | undefined; read: boolean } => {
  if (latest !== undefined && start < latest.start) {
    return { latest, read: false }
  }
  if (latest !== undefined && url === latest.url && !latest.failed) {
    return { latest: { ...latest, start }, read: false }
  }
  return { latest: { url, start, failed: false, read }, read: true }
}

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
  let reads = 0

  const read = (url: string, number: number) => {
    track = undefined
    void fetchText(url).match(
      (text) => {
        if (latest?.read === number) {
          track = trackOf(text, site, url)
        }
      },
      (error) => {
        console.warn("Could not read the subtitle file", url, error)
        if (latest?.read === number) {
          latest = { ...latest, failed: true }
        }
      },
    )
  }

  const observer = new PerformanceObserver((entries) => {
    for (const { name, startTime } of entries.getEntries()) {
      if (site.file.test(name)) {
        const next = requested(latest, name, startTime, reads + 1)
        latest = next.latest
        if (next.read) {
          reads++
          read(name, reads)
        }
      }
    }
  })
  observer.observe({ type: "resource", buffered: true })
  ctx.onInvalidated(() => observer.disconnect())

  return { track: () => track }
}
