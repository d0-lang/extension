/** Sites the extension does more on than plain text lookups, each with its own switch. */
import { getYoutubeCaptions, setYoutubeCaptions } from "$lib/storage"

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

export const integrations: ReadonlyArray<Integration> = [
  {
    name: "YouTube",
    kind: "Video",
    description: "Clickable subtitles",
    key: "youtubeCaptions",
    get: getYoutubeCaptions,
    set: setYoutubeCaptions,
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
