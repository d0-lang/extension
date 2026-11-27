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

/**
 * Reads each subtitle file of `site` the page loads, which its player does when its subtitles go on. The file asked
 * for last is the track, and none is while it loads, so another video's cues never show over this one.
 */
export const watchSiteFiles = (
  ctx: ContentScriptContext,
  site: SiteFiles,
): { track: () => Track | undefined } => {
  let track: Track | undefined
  let latest: string | undefined

  const read = (url: string) => {
    latest = url
    track = undefined
    void fetchText(url).match(
      (text) => {
        if (url === latest) {
          track = trackOf(text)
        }
      },
      (error) => console.warn("Could not read the subtitle file", url, error),
    )
  }

  // The player asks again for the file it has when its subtitles go back on, which needs no second read.
  const observer = new PerformanceObserver((entries) => {
    for (const { name } of entries.getEntries()) {
      if (site.file.test(name) && name !== latest) {
        read(name)
      }
    }
  })
  observer.observe({ type: "resource", buffered: true })
  ctx.onInvalidated(() => observer.disconnect())

  return { track: () => track }
}
