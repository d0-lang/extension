/** Credit for a server's sources: what saving stores, and which links in an answer the client shows. */
import type { CreditSource } from "../storage"
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
 * The source that names `link`: the first that covers `lang` and whose `url` has the same origin.
 * Unset for a link that is not `https`, or whose origin no such source has, so the link is not shown.
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
  return sources.find(
    (source) => coversLanguage(source, lang) && URL.parse(source.url)?.origin === url.origin,
  )
}

/**
 * A link the popover lists: an entry's page, or the page that credits one of its recordings.
 * `recording` numbers the recordings of an entry that has more than one.
 */
export type SourceLink = { href: string; name: string; lemma: string } & (
  { kind: "entry" } | { kind: "recording"; recording: number | undefined }
)

const unique = (values: ReadonlyArray<string>): Array<string> => [...new Set(values)]

/**
 * Links for `entries`, in order, each `href` once: the entry's pages, then every recording it was sent with.
 * Two audio items with the same `source` are one recording. Links no source names are left out.
 */
export const sourceLinks = (
  entries: ReadonlyArray<LookupEntry>,
  sources: ReadonlyArray<CreditSource>,
  lang: string | undefined,
): Array<SourceLink> => {
  const links = entries.flatMap((entry): Array<SourceLink> => {
    const recordings = unique((entry.pron?.audio ?? []).flatMap(({ source }) => source ?? []))
    return [
      ...unique(entry.sources ?? []).map((href) => ({ href, kind: "entry" as const })),
      ...recordings.map((href, index) => ({
        href,
        kind: "recording" as const,
        recording: recordings.length > 1 ? index + 1 : undefined,
      })),
    ].flatMap((link) => {
      const source = creditedSource(link.href, sources, lang)
      return source === undefined ? [] : [{ ...link, name: source.name, lemma: entry.lemma }]
    })
  })
  return links.filter((link, index) => links.findIndex(({ href }) => href === link.href) === index)
}
