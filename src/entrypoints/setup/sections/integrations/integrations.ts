/** Sites the extension does more on than plain text lookups, each with its own switch. */
import {
  getSiteSubtitles,
  getVideoSubtitles,
  getYoutubeCaptions,
  setSiteSubtitles,
  setVideoSubtitles,
  setYoutubeCaptions,
  siteSubtitlesKey,
  type SubtitleSite,
} from "$lib/storage"

export type Integration = {
  name: string
  /** The group it is listed under. */
  kind: "Video"
  /** What it adds to the site. */
  description: string
  /** The storage key `get` reads, to reload when it changes. */
  key: string
  get: () => Promise<boolean>
  set: (on: boolean) => Promise<void>
}

/** A site whose subtitle files the extension reads, with its own switch. */
const siteIntegration = (site: SubtitleSite, name: string, description: string): Integration => ({
  name,
  kind: "Video",
  description,
  key: siteSubtitlesKey(site),
  get: () => getSiteSubtitles(site),
  set: (on) => setSiteSubtitles(site, on),
})

export const integrations: ReadonlyArray<Integration> = [
  {
    name: "YouTube",
    kind: "Video",
    description: "Clickable subtitles",
    key: "youtubeCaptions",
    get: getYoutubeCaptions,
    set: setYoutubeCaptions,
  },
  siteIntegration("ard", "ARD Mediathek", "Clickable subtitles, on tagesschau.de too"),
  siteIntegration("zdf", "ZDF", "Clickable subtitles"),
  siteIntegration("arte", "Arte", "Clickable subtitles"),
  {
    name: "Other sites",
    kind: "Video",
    description: "Clickable subtitles on sites like Vimeo",
    key: "videoSubtitles",
    get: getVideoSubtitles,
    set: setVideoSubtitles,
  },
]

/** A list this long gets a search box. */
export const SEARCH_FROM = 8

/** The integrations whose name holds `query`, under their kind, in list order. */
export const groupIntegrations = (
  list: ReadonlyArray<Integration>,
  query = "",
): Array<{ kind: Integration["kind"]; items: Array<Integration> }> => {
  const needle = query.trim().toLowerCase()
  const groups = new Map<Integration["kind"], Array<Integration>>()
  for (const integration of list) {
    if (integration.name.toLowerCase().includes(needle)) {
      groups.set(integration.kind, [...(groups.get(integration.kind) ?? []), integration])
    }
  }
  return [...groups].map(([kind, items]) => ({ kind, items }))
}
