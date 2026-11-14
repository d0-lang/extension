/** Credit for a server's sources: what saving stores, and which links in an answer the client shows. */
import type { CreditSource } from "../storage"
import { playableAudio } from "./entries"
import type { LookupEntry, ServerSource } from "./types"

/** What saving the server stores as its sources. */
export const creditSources = (sources: ReadonlyArray<ServerSource> | undefined): Array<CreditSource> =>
  (sources ?? []).map(({ name, url, license, license_url, languages }) => ({
    name,
    url,
    ...(license === undefined ? {} : { license }),
    ...(license_url === undefined ? {} : { licenseUrl: license_url }),
    ...(languages === undefined ? {} : { languages }),
  }))

/** Whether `source` lists `lang`. A source without `languages` covers every pair. */
export const coversLanguage = (source: CreditSource, lang: string | undefined): boolean =>
  source.languages === undefined || (lang !== undefined && source.languages.includes(lang))

/**
 * The source that names `link`: one whose `url` has the same origin, preferring one that covers `lang`.
 * Unset for a link that is not `https`, or whose origin no source has, so the link is not shown.
 */
export const creditedSource = (
  link: string,
  sources: ReadonlyArray<CreditSource>,
  lang: string | undefined,
): CreditSource | undefined => {
  const url = URL.parse(link)
  if (url === null || url.protocol !== "https:") {
    return undefined
  }
  const matching = sources.filter((source) => URL.parse(source.url)?.origin === url.origin)
  return matching.find((source) => coversLanguage(source, lang)) ?? matching[0]
}

/** A link the popover lists: an entry's page, or the page that credits its recording. */
export type SourceLink = { href: string; name: string; lemma: string; kind: "entry" | "recording" }

/**
 * Links for `entries`, in order, each `href` once. A recording is the one the entry plays.
 * Links no source names are left out.
 */
export const sourceLinks = (
  entries: ReadonlyArray<LookupEntry>,
  sources: ReadonlyArray<CreditSource>,
  lang: string | undefined,
  server: string | undefined,
): Array<SourceLink> => {
  const links = entries.flatMap((entry) => {
    const recording = playableAudio(entry, server)?.source
    return [
      ...(entry.sources ?? []).map((href) => ({ href, kind: "entry" as const })),
      ...(recording === undefined ? [] : [{ href: recording, kind: "recording" as const }]),
    ].flatMap(({ href, kind }) => {
      const source = creditedSource(href, sources, lang)
      return source === undefined ? [] : [{ href, name: source.name, lemma: entry.lemma, kind }]
    })
  })
  return links.filter((link, index) => links.findIndex(({ href }) => href === link.href) === index)
}
