/**
 * The report page's links. Neither carries the sentence around the word or the page the user is on:
 * a link is built only from the fields named here.
 */
import type { LastLookup, Servers } from "$lib/storage"

/** The client name in `client`, as the protocol spells it: `dadict/0.6.0`. */
const CLIENT_NAME = "dadict"

const PAGE_ISSUE_FORM = "https://github.com/d0-lang/extension/issues/new?template=page.yml"

/** `reportUrl` with `word`, `lang` and `client` added to the query it already has. Unset unless it is `https`. */
export const wordReportLink = (
  reportUrl: string,
  { word, lang }: Pick<LastLookup, "word" | "lang">,
  version: string,
): URL | undefined => {
  const url = URL.parse(reportUrl)
  if (url === null || url.protocol !== "https:") {
    return undefined
  }
  url.searchParams.append("word", word)
  url.searchParams.append("lang", lang)
  url.searchParams.append("client", `${CLIENT_NAME}/${version}`)
  return url
}

/** The "wrong or missing meaning" choice: what it opens, and the word and host it names. */
export type WordReport = { href: string; word: string; host: string }

/** Unset before the tab's first answered lookup, or when the server that answered it has no `report_url`. */
export const wordReport = (
  lookup: LastLookup | undefined,
  servers: Servers,
  version: string,
): WordReport | undefined => {
  if (lookup === undefined) {
    return undefined
  }
  const reportUrl = servers[lookup.server]?.reportUrl
  const url = reportUrl === undefined ? undefined : wordReportLink(reportUrl, lookup, version)
  return url === undefined ? undefined : { href: url.href, word: lookup.word, host: url.host }
}

/** The version as a page report names it: `0.6.0 (a1b2c3d)`, or just `0.6.0` when the commit is not known. */
export const buildName = (version: string, commit: string | undefined): string =>
  commit ? `${version} (${commit})` : version

/** This repo's "Doesn't work on a page" form, with the browser and the extension version filled in. */
export const pageIssueLink = (browserName: string | undefined, version: string): string => {
  const url = new URL(PAGE_ISSUE_FORM)
  if (browserName !== undefined) {
    url.searchParams.set("browser", browserName)
  }
  url.searchParams.set("version", version)
  return url.href
}
